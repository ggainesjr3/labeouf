🛡️ LaBeouf: Tactical Trust-Audit Terminal

LaBeouf is a high-fidelity social media clone and security auditing tool. It combines a Brutalist/Industrial UI with a Machine Learning backend to monitor data streams for misinformation and linguistic anomalies in real-time.
🚀 Deployment & Environment

    Host Environment: Linux (Ubuntu/Debian) – Host: rosencrantz

    Frontend: React.js (Mobile-First / Standalone PWA)

    Backend: Firebase (Firestore, Authentication, Hosting)

    ML Integration: BERT-based Trust Guard (Natural Language Processing)

📱 Cross-Platform Strategy
iOS Deployment (PWA Handshake)

Bypassing the need for a MacBook/Xcode, LaBeouf utilizes a Progressive Web App strategy to achieve a native feel on iPhone.

    Standalone Mode: Configured via manifest.json to remove browser UI and unlock system-level APIs.

    Tactical Handshake: Implemented a manual "User Gesture" trigger to unlock iOS Web Push Notifications.

    Safe-Area Optimization: Custom CSS boundaries to protect UI elements from the iOS "Notch" and home indicator.

Android Deployment

    Deployed as a PWA via Chrome, allowing for deep integration with Android's notification listener.

    Responsive Brutalist Grid adapts to varying screen densities across the Android ecosystem.

🧠 Trust Guard AI (The Core)

The application features a proprietary auditing layer that scans every post before it hits the global stream.

    Heuristic Analysis: Detects "All-Caps" spamming, repetitive character patterns, and common disinformation triggers.

    BERT Integration: Evaluates linguistic bias and assigns a TrustScore to each packet of data.

    Global Threat Level: A rolling calculation of "Anomalies" vs "Verified" logs that updates the system's global state (LOW, ELEVATED, CRITICAL).

🏗️ Defensive Engineering Patterns

Designed for stability and reliability, the codebase follows strict defensive protocols:

    Input Sanitization: Every log entry is scrubbed for malicious scripts before being committed to Firestore.

    Error Boundaries: Prevents application-wide crashes by isolating component failures within the UI.

    Null-Safety: Robust handling of Firebase Auth states to ensure "ANON_OPERATOR" fallbacks for unauthenticated data streams.

🛠️ Tech Stack

    Styling: Custom Brutalist CSS (High-Contrast, Tactical Industrial Aesthetics)

    Database: Cloud Firestore (Real-time NoSQL)

    Analytics: Integrated "Anomalies" counter for live stream auditing.

Installation (Linux Environment)
Bash

# Clone the repository
git clone https://github.com/gary-edward/labeouf.git

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

Developed by Gary Edward Gaines, Jr. Software & Machine Learning Engineering (Novice) Philadelphia, PA / Southern NJ