# Birthday wish photo gallery

## Connect the app to MongoDB Atlas

The Atlas console URL identifies the project, but the app also needs a database
connection string and a database user's credentials.

1. In Atlas, open **Database Access** and create a database user.
2. Open **Network Access** and allow the IP address of the computer running this
   app.
3. Open **Connect → Drivers**, choose Node.js, and copy the connection string.
4. Copy `.env.example` to `anish.env`. Set `MONGODB_URI` to the copied string and
   replace its username/password placeholders with the database user's credentials.
   The birthday page login defaults to username `love` and password `love`;
   `LOGIN_USERNAME` and `LOGIN_PASSWORD` can override these values.
5. Start the app with `npm run dev`, then open the local Vite URL shown in the
   terminal.

`MONGODB_URI` must start with `mongodb+srv://` (or `mongodb://` for a standard
connection). Do not paste the `https://cloud.mongodb.com/...` Atlas dashboard
URL there; it is not a database connection string.

Do not share the Atlas database password or commit `anish.env`. This file is
ignored by Git. If a database password contains reserved URL characters, URL
encode it before putting it in the connection string.

## Image storage

Images are stored in MongoDB Atlas using GridFS, in the `birthdayImages.files`
and `birthdayImages.chunks` collections inside the database named by
`MONGODB_DB_NAME` (defaults to `birthday_wish`). The app accepts JPEG, PNG,
WebP, GIF, and AVIF images up to 8 MB each. Uploaded photos are shown in the
gallery through the app's API.

The birthday page and photo API require the login. The default `love` / `love`
credentials are intentionally simple for this private demo; set private
`LOGIN_USERNAME` and `LOGIN_PASSWORD` values before deploying publicly. Login is
rate-limited and creates an HTTP-only session cookie. The newest uploaded image
appears as Chinju's birthday photo. Until one is uploaded, the page shows
`public/birthday-girl-placeholder.svg`. For a publicly deployed site, host the
API behind HTTPS.
