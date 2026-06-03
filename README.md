## Choropleth/Histogram plot for map baed EDA

This is a work in progress, but will eventually be a platform for a map based exporitory data analysis.  The insipration for this are the great brusable EDA tools from the [Geoda](https://geodacenter.github.io/) platfor that I have been using for many years.  Don't know how it is possible the ESRI/QGIS applications haven't stolen those tools for their own platforms yet but ¯\_(ツ)_/¯

Similarly, I have been looking around for anyone who has made any similar interactive charts for outward data visualization purposed but havven't been able to find any examples that are quite what I want.  So this is an effort to try to do it myself.

This version will take the form of a choropleth map alongside a histogram of the same variable.  Both map and plot with be brusahable and will highlight the selected data on the opposite plot.  Cases selected in histogram with nbe highlighted in the map and units selected in the map will generate their own histogram superimposed on the population plot.

I published the results (so far) through [Github Pages](https://ecg2104.github.io/ChoroplethEDAUnivariate/)

## Acknowledgements

Ideas stolen from Geoda:

Anselin, Luc, Ibnu Syabri and Youngihn Kho (2006). GeoDa: An Introduction to Spatial Data Analysis. Geographical Analysis 38 (1), 5-22.

Color palates from ColorBrewer:

ColorBrewer: Color Advice for Maps. (n.d.). Retrieved June 3, 2026, from https://colorbrewer2.org/#type=sequential&scheme=BuGn&n=3

Most of the code written by Claude
