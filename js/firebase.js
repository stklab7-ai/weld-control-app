/**
 * firebase.js — подключение к Firebase Firestore
 */

// Импорты Firebase (модульный SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ===== ВАША КОНФИГУРАЦИЯ =====
const firebaseConfig = {
  apiKey: "AIzaSyD-TtXFx4Cd1TnxAfrku1yCoseVBIGkhgw",
  authDomain: "weld-control-app.firebaseapp.com",
  projectId: "weld-control-app",
  storageBucket: "weld-control-app.firebasestorage.app",
  messagingSenderId: "886490517194",
  appId: "1:886490517194:web:864fad5c5372f1ce57ee33",
  measurementId: "G-680NV4TY7J"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const requestsCollection = collection(db, "requests");

// Экспорт
export { 
  db,
  requestsCollection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
};