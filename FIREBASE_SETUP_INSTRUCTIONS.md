
# Firebase Authentication Setup Instructions

This guide will walk you through setting up Firebase Authentication for your project to support Email/Password, Google, and Phone Number sign-in methods.

## 1. Create a Firebase Project

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Click **Add project** and follow the on-screen instructions to create a new project.

## 2. Register Your Web App

1.  In your Firebase project, go to the **Project Overview** page.
2.  Click the **Web** icon (</>) to open the "Add Firebase to your web app" workflow.
3.  Enter a nickname for your app and click **Register app**.
4.  You will be given a Firebase configuration object. Copy this object. You will need it for your application's Firebase initialization.

## 3. Enable Authentication Methods

1.  In the Firebase Console, go to the **Authentication** section.
2.  Click the **Sign-in method** tab.
3.  Enable the following sign-in providers:
    *   **Email/Password**: Enable this provider.
    *   **Google**: Enable this provider. You may need to provide a project support email.
    *   **Phone**: Enable this provider.

## 4. Configure Phone Number Authentication

1.  **reCAPTCHA Verification**: Phone number sign-in with a visible reCAPTCHA is the default verification method. To use an invisible reCAPTCHA, as implemented in the login page, you need to configure it. The code already includes the necessary setup for an invisible reCAPTCHA.
2.  **Authorized Domains**: You must add the domains that will host your app to the list of authorized domains in the Firebase Console.
    *   Go to the **Authentication** section.
    *   Click the **Settings** tab.
    *   Under **Authorized domains**, click **Add domain** and add your development and production domains (e.g., `localhost`, `your-app.com`).

## 5. Get Firebase Configuration for Your App

1.  In your Firebase project, go to **Project settings** (click the gear icon next to Project Overview).
2.  In the **Your apps** card, select the web app for which you need a configuration object.
3.  Under **Firebase SDK snippet**, click **Config**.
4.  Copy the `firebaseConfig` object. This should be used to initialize Firebase in your application (e.g., in `apps/web/src/lib/firebase.ts`).

## 6. Set Up Firebase Admin SDK (for the backend)

1.  In the Firebase Console, go to **Project settings**.
2.  Click the **Service accounts** tab.
3.  Click **Generate new private key**. A JSON file containing your service account credentials will be downloaded.
4.  **Important**: Keep this file secure. Do not commit it to your version control.
5.  Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of the JSON file you downloaded. This will allow the Firebase Admin SDK to authenticate with your Firebase project.

    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
    ```

    Alternatively, you can initialize the Admin SDK with the service account credentials directly in your code, but using an environment variable is recommended for better security.

By following these steps, you will have a Firebase project configured to support all the authentication methods implemented in the new login page.
