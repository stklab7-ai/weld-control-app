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
  orderBy,
  setDoc,
  getDoc
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

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Коллекции
const requestsCollection = collection(db, "requests");
const usersCollection = collection(db, "users");

// ===== ЭКСПОРТ =====
export { 
  // Firebase
  app,
  db,
  
  // Коллекции
  requestsCollection,
  usersCollection,
  
  // Методы Firestore
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc
};