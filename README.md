API implementation checklist:
[x] $ nb stream modify emails.unread --name "unread emails"
modified the stream named unread emails.

[ ] $ nb stream list
emails
  .unread ("unread emails") number

[x] $ nb note emails.unread 132
noted 132 emails.unread.

[x] $ nb denote emails.unread
removed latest note (132 at timestamp).

[x] $ nb denote emails.unread 100
removed note 100 (129 at index 100).

[x] $ nb note emails.unread 132 --timestamp timestamp
noted 132 at timestamp.

[x] $ nb stream show emails.unread --format csv

[ ] $ nb stream show emails.unread --format table

[ ] $ nb stream show emails.unread --format graph

[ ] $ nb stream show emails.unread --format json

[ ] $ nb stream show emails.unread --format timeline
