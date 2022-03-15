Proposed API:
$ nb note emails.unread 132
stream emails.unread does not exist.

$ nb stream add emails.unread number
created a stream of numbers named emails.unread.

$ nb stream add emails.unread number
did not create stream; a stream with id emails.unread already exists

$ nb stream modify emails.unread --name "unread emails"
modified the stream of numbers named unread emails.

$ nb stream list
emails
  .unread ("unread emails") number

$ nb note emails.unread 132
noted 132 emails.unread.

$ nb note emails.unread asdf
could not note, asdf is not a number.

$ nb denote emails.unread
removed latest note (132 at timestamp).

$ nb note emails.unread 132 --timestamp timestamp
noted 132 at timestamp.

$ nb stream show emails.unread --format table

$ nb stream show emails.unread --format graph

$ nb stream show emails.unread --format json

$ nb stream show emails.unread --format timeline
