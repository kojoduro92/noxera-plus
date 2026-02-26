# Firebase Linkage Guide for Noxera Plus

To connect your **Noxera Plus** platform to your own Firebase project, follow these detailed steps. This will enable real-world authentication and enterprise-level security.

## 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the instructions to create a new project named "Noxera Plus".
3. Disable Google Analytics for now unless you specifically need it for Phase 3.

## 2. Enable Authentication
1. In the left sidebar, click **Build** > **Authentication**.
2. Click **Get started**.
3. Under the **Sign-in method** tab, enable **Email/Password**.
4. (Optional) Enable **Google** or **Phone** providers for Phase 2 mobile integration.

## 3. Register your Web App
1. On the Project Overview page, click the **Web icon (`</>`)** to add an app.
2. Enter "Noxera Plus Web" as the app nickname.
3. **Important**: Copy the `firebaseConfig` object that appears. It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.firebasestorage.app",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

## 4. Configure Environment Variables
1. Open the file `apps/web/.env.local` in your editor.
2. Fill in the values from the `firebaseConfig` object into the respective variables:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
   NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
   NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
   ```

## 5. (Backend) Enable Admin SDK
1. In the Firebase Console, go to **Project settings** > **Service accounts**.
2. Click **Generate new private key**, then download the JSON file.
3. For enterprise readiness, the backend (`apps/api`) needs the **Project ID**.
4. Update `apps/api/.env` (or create it) with:
   ```env
   FIREBASE_PROJECT_ID="your-project-id"
   ```
   *Note: The backend conditionally initializes based on this ID for development safety.*

## 6. Create your Super Admin User
1. Go to the **Authentication** > **Users** tab in Firebase.
2. Click **Add user**.
3. Create a user with your email: `kojoduro92@gmail.com`.
4. The platform is pre-configured to recognize this specific email as the master Super Admin.

## 7. Launch Platform
Restart your development server:
```bash
pnpm dev
```
You can now log in at `http://localhost:3001/super-admin/login` using your real Firebase credentials!
