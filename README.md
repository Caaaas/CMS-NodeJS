# Node.js CMS
This CMS system built in Node JS was meant to be, and was used for a gaming community. However, due to time constraints that part has been but on ice. Therefore I'm opening this up to the public.

Please note, I used this project as a way of learning Node JS and a lot of general things about web development. Therefore a lot of code will differ and not follow the same design or way of functioning. It does also not represent how I would attack as big of a project as this was if I were to do it again. I would for example use a MVC style rather then just pushing everything in together. I would use Promises instead of the Async library, and so on. 

To see better examples on how I would structure something in the future, take a look at my newer public repositories.

### To run, if I remeber correctly.
- Download.
- Install npm modules.
- Upload DB data.
  - With content preferably
  - Else, fill out the settings table.
- Rename .env.example to .env and fill it out.

### Some featutures, currently in this CMS, in no particular order
- News slider, with configurabel amount of news, loading from a specific forum board.
- Forum system, with moderator actions like delete/undelete, lock, sticky, edit.
- Live chat powered through socket.io.
- Permisson based system through MySQL DB.
- Hide topics and/or boards from main page for specific users.
  - Only available through database modification directly.
- Connect account to Steam API.
- Verify account through email.
- Reset password through email.
- Upload and crop profile picture.
- Reactions system on forum posts.
- IP logging.
- Server list for the game CS:GO.
- Forum topic tags.
- IP banning. 

And more, that I probably forgot.

Sadly, it's not really documented, something I should have done, but hey, it's more fun coding and learning. Also, the project was first intended for me only, so it's kind of in my head. I do properly comment my code when actually working!

As of writing this, a version of it is currently active on https://casperj.se
No guarantee it will be up as of you looking it up. Registration is inactive due to the mail server being down, so you can't verify your account. Might get around to fixing that in the future jsut because. Also might get around to implement som standard guest accounts.

Some default test accounts:
admin admin - Admin with full on permission
user user - Normal user with some default user permissions.

If you have any questions, feel free to open an issue or contact me by email!
