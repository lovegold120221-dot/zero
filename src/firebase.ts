import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCiPY9UZUpoZsy2AReHkb-HDB0FtxYd_T0",
  authDomain: "eburon-ai-beatrice.firebaseapp.com",
  databaseURL: "https://eburon-ai-beatrice-default-rtdb.firebaseio.com",
  projectId: "eburon-ai-beatrice",
  storageBucket: "eburon-ai-beatrice.firebasestorage.app",
  messagingSenderId: "874569824011",
  appId: "1:874569824011:web:b5ec70e6e2adced9b0140e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

