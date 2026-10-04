# GrailFindr app (iPhone + Android)

Expo / React Native app. Uses the same Supabase database and alert system as the website.

## Run on your phone (development)
1. Install **Expo Go** from the App Store.
2. In this folder: `npm install`, then `npx expo start`.
3. Scan the QR code with your iPhone camera.

Push notifications only work in a real build (step below), not Expo Go.

## Build for the App Store
1. `npm install -g eas-cli`, then `eas login` (free Expo account).
2. `eas init` (links the project and enables push).
3. `eas build --platform ios` (needs your Apple Developer account).
4. `eas submit --platform ios` → appears in TestFlight / App Store Connect.

Store listing copy: `STORE_LISTING.md`.
