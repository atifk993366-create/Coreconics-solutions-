"use client";
import { initializeApp, getApps } from "firebase/app"; import { getAuth } from "firebase/auth";
const cfg = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID };
export const fbAuth = () => getAuth(getApps().length ? getApps()[0] : initializeApp(cfg));
