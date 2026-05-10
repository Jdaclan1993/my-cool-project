# H-Statistic (Kruskal-Wallis H test)

The H-statistic is a non‑parametric test used to determine whether there are statistically significant differences between two or more groups of an independent variable on a continuous or ordinal dependent variable. It is an extension of the Mann‑Whitney U test to more than two groups.

## Formula

\[
H = \frac{12}{N(N+1)} \sum_{i=1}^{k} \frac{R_i^2}{n_i} - 3(N+1)
\]

where:
- \(N\) = total number of observations across all groups
- \(k\) = number of groups
- \(n_i\) = number of observations in group \(i\)
- \(R_i\) = sum of ranks for group \(i\)

## Interpretation

The test statistic \(H\) approximately follows a chi‑square distribution with \(k-1\) degrees of freedom when the sample sizes are sufficiently large. A significant result indicates that at least one group differs from the others.

## Assumptions

- The dependent variable should be measured at the ordinal or continuous level.
- The independent variable should consist of two or more categorical, independent groups.
- Observations should be independent.
- The distributions of the groups should have the same shape (though the test is robust to moderate violations).

## Example Use Cases

- Comparing customer satisfaction scores across three different store layouts.
- Evaluating the effectiveness of multiple teaching methods on exam performance.
- Analyzing plant growth under different fertilizer treatments.

## References

- Kruskal, W. H., & Wallis, W. A. (1952). Use of ranks in one‑criterion variance analysis. *Journal of the American Statistical Association*, 47(260), 583‑621.
- Siegel, S., & Castellan, N. J. (1988). *Nonparametric Statistics for the Behavioral Sciences* (2nd ed.). McGraw‑Hill.
