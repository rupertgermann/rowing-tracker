replace that ugly alert confirmation dialogs with something more modern
-> still present in "plans" module when deleting a plan, possible some other modules too

- the chat window does not show confirmation when deleting a chat

- make sure that every form field for a prompt input uses the real DEFAULT_*_PROMPT for the field, see DEFAULT_AWARD_SUGGESTIONS_PROMPT as example. instead of a placeholder string or an empty string, so “Reset to default” matches the actual prompt constant. update the placeholders to use the DEFAULT_*_PROMPT too.


- add more context to the list of earned awards in the ai award suggestions prompt: title, description, and criteria for each award, including the date earned and any relevant performance metrics such as time, distance, or stroke rate.