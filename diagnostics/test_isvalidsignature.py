import os
import sys
import time

from dotenv import load_dotenv
from eth_abi import encode as abi_encode
from eth_utils import keccak, to_bytes
from web3 import Web3

from py_clob_client_v2.order_utils.exchange_order_builder_v2 import (
    DEPOSIT_WALLET_DOMAIN_SALT,
    DEPOSIT_WALLET_NAME_HASH,
    DEPOSIT_WALLET_VERSION_HASH,
    ORDER_TYPE_HASH,
    SOLADY_TYPE_HASH,
    ExchangeOrderBuilderV2,
)
from py_clob_client_v2.order_utils.model.order_data_v2 import OrderDataV2
from py_clob_client_v2.order_utils.model.side import Side
from py_clob_client_v2.order_utils.model.signature_type_v2 import SignatureTypeV2
from py_clob_client_v2.signer import Signer


RPC_URL = "https://polygon-bor.publicnode.com"
CHAIN_ID = 137
CTF_EXCHANGE_V2 = "0xE111180000d2663C0091e4f400237545B87B996B"
VALID_ERC1271_MAGIC_VALUE = "0x1626ba7e"
BYTES32_ZERO = "0x" + "00" * 32

ERC1271_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_hash", "type": "bytes32"},
            {"internalType": "bytes", "name": "_signature", "type": "bytes"},
        ],
        "name": "isValidSignature",
        "outputs": [{"internalType": "bytes4", "name": "", "type": "bytes4"}],
        "stateMutability": "view",
        "type": "function",
    }
]


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        print(f"Missing required env var: {name}")
        sys.exit(2)
    return value


def bytes4_hex(value) -> str:
    if isinstance(value, str):
        return value if value.startswith("0x") else "0x" + value
    return "0x" + bytes(value).hex()


def order_struct_hash(message: dict) -> bytes:
    return keccak(
        abi_encode(
            [
                "bytes32",
                "uint256",
                "address",
                "address",
                "uint256",
                "uint256",
                "uint256",
                "uint8",
                "uint8",
                "uint256",
                "bytes32",
                "bytes32",
            ],
            [
                ORDER_TYPE_HASH,
                int(message["salt"]),
                message["maker"],
                message["signer"],
                int(message["tokenId"]),
                int(message["makerAmount"]),
                int(message["takerAmount"]),
                int(message["side"]),
                int(message["signatureType"]),
                int(message["timestamp"]),
                to_bytes(hexstr=message["metadata"].hex()),
                to_bytes(hexstr=message["builder"].hex()),
            ],
        )
    )


def erc7739_typed_data_sign_struct_hash(message: dict, contents_hash: bytes) -> bytes:
    return keccak(
        abi_encode(
            [
                "bytes32",
                "bytes32",
                "bytes32",
                "bytes32",
                "uint256",
                "address",
                "bytes32",
            ],
            [
                SOLADY_TYPE_HASH,
                contents_hash,
                DEPOSIT_WALLET_NAME_HASH,
                DEPOSIT_WALLET_VERSION_HASH,
                CHAIN_ID,
                message["signer"],
                DEPOSIT_WALLET_DOMAIN_SALT,
            ],
        )
    )


def main() -> int:
    load_dotenv()

    deposit_wallet_address = Web3.to_checksum_address(
        require_env("DEPOSIT_WALLET_ADDRESS")
    )
    eoa_private_key = require_env("POLYMARKET_EOA_PRIVATE_KEY")

    signer = Signer(eoa_private_key, CHAIN_ID)
    builder = ExchangeOrderBuilderV2(CTF_EXCHANGE_V2, CHAIN_ID, signer)

    order_data = OrderDataV2(
        maker=deposit_wallet_address,
        signer=deposit_wallet_address,
        signatureType=SignatureTypeV2.POLY_1271,
        tokenId="1234567890123456789012345678901234567890",
        makerAmount="1000000",
        takerAmount="2000000",
        side=Side.BUY,
        timestamp=str(int(time.time())),
        metadata=BYTES32_ZERO,
        builder=BYTES32_ZERO,
    )

    order = builder.build_order(order_data)
    typed_data = builder.build_order_typed_data(order)
    sig = builder._build_poly_1271_order_signature(typed_data)
    sig_bytes = Web3.to_bytes(hexstr=sig)

    struct_hash = order_struct_hash(typed_data["message"])
    app_domain_separator = builder.app_domain_separator
    order_hash = keccak(b"\x19\x01" + app_domain_separator + struct_hash)

    erc7739_struct_hash = erc7739_typed_data_sign_struct_hash(
        typed_data["message"], struct_hash
    )
    erc7739_digest = keccak(b"\x19\x01" + app_domain_separator + erc7739_struct_hash)

    web3 = Web3(Web3.HTTPProvider(RPC_URL))
    contract = web3.eth.contract(address=deposit_wallet_address, abi=ERC1271_ABI)

    order_result = bytes4_hex(
        contract.functions.isValidSignature(order_hash, sig_bytes).call()
    )
    erc7739_result = bytes4_hex(
        contract.functions.isValidSignature(erc7739_digest, sig_bytes).call()
    )

    order_valid = order_result.lower() == VALID_ERC1271_MAGIC_VALUE
    erc7739_valid = erc7739_result.lower() == VALID_ERC1271_MAGIC_VALUE

    print(f"isValidSignature order_hash result: {order_result}")
    print(f"VALID order_hash={order_valid}")
    print(f"isValidSignature ERC-7739 digest result: {erc7739_result}")
    print(f"VALID ERC-7739 digest={erc7739_valid}")
    print(f"sig length: {len(sig_bytes)}")
    print(f"order hash hex: 0x{order_hash.hex()}")
    print(f"ERC-7739 digest hex: 0x{erc7739_digest.hex()}")
    print(f"APP_DOMAIN_SEPARATOR hex: 0x{app_domain_separator.hex()}")

    if order_valid:
        print("valid hash: order_hash")
    elif erc7739_valid:
        print("valid hash: ERC-7739 digest")
    else:
        print("valid hash: none")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
