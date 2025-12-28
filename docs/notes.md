# notes 

- fix lint errors "npm run lint"

- existing "explain"-chats-links for charts showing data of many sessions should not be re-set when session data changes. f.i. the charts in /analytics should always to to an existing chat, even if the data changed since this chat was created. for single-session charts, a new chat should be created.

- selected segments in Segment Analysis are not stored. they should be stored persistent in the database in the same way as "Select Charts to Display" (ond other chart related settings)


- cleanup /docs folder and update main README.md 

## Task: Fix orphaned training plan detection
- I see already deleted training plans in the memory manager (Coach memory) in chat. check if we have garbage collection / orphaned memories detection and make sure it works reliably?



## Task: Improve analytics loading performance

How can we improve the loading performance of the "analytics" module? Currently it seems that there is no caching in place because every time I open it, it needs ~3 seconds until I see something on the screen. That is not acceptable. Come up with some innovative and effective concepts to improve the loading time of the "analytics" page. When you are sure you found the best solution, implement it. I expect the page to load as fast as the others and that all heavy computations are cached as long as relevant data is not changed. Lazy loading/computation would possibly also be helpful.


## Task: add import/export complete user account data functionality
