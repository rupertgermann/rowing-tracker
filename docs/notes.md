# notes 





- cleanup /docs folder and update main README.md 

 in award-details add a possibility to select one of the existing Color Palette for the award image generation. keep the Color Palette selection in settings as global fallback if the user does not select a color palette for the award image generation in a certain award. make sure the available color palettes can be changed at one point in the code. 



## Task: Improve analytics loading performance

How can we improve the loading performance of the "analytics" module? Currently it seems that there is no caching in place because every time I open it, it needs ~3 seconds until I see something on the screen. That is not acceptable. Come up with some innovative and effective concepts to improve the loading time of the "analytics" page. When you are sure you found the best solution, implement it. I expect the page to load as fast as the others and that all heavy computations are cached as long as relevant data is not changed. Lazy loading/computation would possibly also be helpful.


## Task: add import/export complete user account data functionality
