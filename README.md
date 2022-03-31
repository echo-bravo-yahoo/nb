# nb
nb (nota bene) is a tool for recording data over time. what sets nb apart is that:
- it's a scrappy, easy to use CLI that gracefully scales to automated workflows
- it's opinionated about use cases and provides "recipes" for them

why did i write nb? in my head, all tasks that take longer than one sitting take the same amount of time to complete: infinite. if i'm to do a task that is large, i need to be able to see progress. this is particularly hard for tasks where your work is routinely being undone.

## domain model
nb is concerned with several types of things. the first is a _stream_. streams are containers for different types of data. one stream might contain the number of unread emails in your inbox, another might contain the number of pages you've written in a day, etc.

streams are built of _notes_. a _note_ is a thruple in the format `(index, timestamp, value)`, and is a record of some thing at some time. most notes will be numbers; do not be concerned by this. they are called notes because you _note_ them, not because they are long-form text.

## workflow
start by identifying something you _think_ might be useful to measure. measure it a few times, recording these measurements with nb in a stream. if you find yourself referring back to the measurements, automate gathering them. if you do not, delete the stream; nb is a tool for collecting data _that helps you do some thing_.

## recipes
### a goal with ups and downs, or a goal with incoming and outgoing work
if you have a goal on something easily measured, consider this recipe. make a stream for the task, and measure and note its value any time you think about it or make progress towards it.

## technical
### where is the data stored
data is stored locally in a flat json database; by default, it's named `database.db`. if you would like to sync it, use the tool of your choice. the author recommends [syncthing](https://syncthing.net/).
