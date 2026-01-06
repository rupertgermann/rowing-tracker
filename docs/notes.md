# notes 


 

- existing "explain"-chats-links for charts showing data of many sessions should not be re-set when session data changes. f.i. the charts in /analytics should always link to an existing chat, even if the data changed since this chat was created. for single-session charts, a new chat should be created.

in chat module all chats in sidebar show "0 messages" despite having messages. also add the time to the date of the chat.

auto-name the chats of type "chat" in sidebar

- cleanup /docs folder and update main README.md 

  



## Task: Improve analytics loading performance

How can we improve the loading performance of the "analytics" module? Currently it seems that there is no caching in place because every time I open it, it needs ~3 seconds until I see something on the screen. That is not acceptable. Come up with some innovative and effective concepts to improve the loading time of the "analytics" page. When you are sure you found the best solution, implement it. I expect the page to load as fast as the others and that all heavy computations are cached as long as relevant data is not changed. Lazy loading/computation would possibly also be helpful.


## Task: add import/export complete user account data functionality
