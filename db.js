// db.js — Firebase (CDN modular) + Auth (Google/Email) + Firestore CRUD + Bimestres + Horários + Chamada
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, enableIndexedDbPersistence,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- suas credenciais ----
const firebaseConfig = {
  apiKey: "AIzaSyA6yovm4aDqfvwnK0ho3OvTfe8e1-Yd9S0",
  authDomain: "professorplus-c0ea2.firebaseapp.com",
  projectId: "professorplus-c0ea2",
  storageBucket: "professorplus-c0ea2.firebasestorage.app",
  messagingSenderId: "435119301289",
  appId: "1:435119301289:web:58b1925274c362ba07bfb8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// offline
enableIndexedDbPersistence(db).catch(()=>{});

// ----- Auth -----
const provider = new GoogleAuthProvider();
export async function loginGoogle(){ await signInWithPopup(auth, provider); }
export async function loginEmail(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
export async function signupEmail(email, password, displayName){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if(displayName){ await updateProfile(cred.user, { displayName }); }
  return cred.user;
}
export async function logout(){ await signOut(auth); }
export function watchAuth(cb){ return onAuthStateChanged(auth, cb); }

// ----- Paths -----
function userRef(uid){ return doc(db, "users", uid); }
function turmasCol(uid){ return collection(db, "users", uid, "turmas"); }
function turmaDoc(uid, tid){ return doc(db, "users", uid, "turmas", tid); }
function alunosCol(uid, tid){ return collection(db, "users", uid, "turmas", tid, "alunos"); }
function alunoDoc(uid, tid, aid){ return doc(db, "users", uid, "turmas", tid, "alunos", aid); }
function atividadesCol(uid, tid){ return collection(db, "users", uid, "turmas", tid, "atividades"); }
function atividadeDoc(uid, tid, aid){ return doc(db, "users", uid, "turmas", tid, "atividades", aid); }
function chamadaCol(uid, tid){ return collection(db, "users", uid, "turmas", tid, "chamada"); }
function chamadaDoc(uid, tid, dateISO){ return doc(db, "users", uid, "turmas", tid, "chamada", dateISO); }
function horariosCol(uid){ return collection(db, "users", uid, "horarios"); }
function horarioDoc(uid, hid){ return doc(db, "users", uid, "horarios", hid); }

// ----- Usuário -----
export async function ensureUser(uid, displayName){
  const uref = userRef(uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    await setDoc(uref, { nome: displayName || "Professor", criadoEm: Date.now() });
  }
}

// ----- Turmas -----
export async function listTurmas(uid){
  const qs = await getDocs(query(turmasCol(uid), orderBy("nome")));
  return qs.docs.map(d=>({ id: d.id, ...d.data() }));
}
export async function createTurma(uid, data){
  const ref = await addDoc(turmasCol(uid), data);
  return { id: ref.id, ...data };
}
export async function updateTurma(uid, tid, data){ await updateDoc(turmaDoc(uid, tid), data); }
export async function deleteTurma(uid, tid){ await deleteDoc(turmaDoc(uid, tid)); }

// ----- Alunos -----
export async function listAlunos(uid, turmaId){
  const qs = await getDocs(query(alunosCol(uid, turmaId), orderBy("nome")));
  return qs.docs.map(d=>({ id: d.id, ...d.data() }));
}
export async function addAluno(uid, turmaId, nome){
  const ref = await addDoc(alunosCol(uid, turmaId), { nome });
  return { id: ref.id, nome };
}
export async function updateAluno(uid, turmaId, alunoId, data){ await updateDoc(alunoDoc(uid, turmaId, alunoId), data); }
export async function deleteAluno(uid, turmaId, alunoId){ await deleteDoc(alunoDoc(uid, turmaId, alunoId)); }

// ----- Atividades & Notas (com bimestre) -----
export async function listAtividades(uid, turmaId, bim=null){
  const base = atividadesCol(uid, turmaId);
  const qs = bim
    ? await getDocs(query(base, where("bimestre","==",Number(bim)), orderBy("data","desc")))
    : await getDocs(query(base, orderBy("data","desc")));
  return qs.docs.map(d=>({ id: d.id, ...d.data() }));
}
export async function addAtividade(uid, turmaId, titulo, data, bimestre){
  const ref = await addDoc(atividadesCol(uid, turmaId), { titulo, data, bimestre: Number(bimestre||1), notas:{} });
  return { id: ref.id, titulo, data, bimestre:Number(bimestre||1), notas:{} };
}
export async function getNotas(uid, turmaId, atividadeId){
  const snap = await getDoc(atividadeDoc(uid, turmaId, atividadeId));
  return snap.data()?.notas || {};
}
export async function saveNotas(uid, turmaId, atividadeId, notasMap){
  await updateDoc(atividadeDoc(uid, turmaId, atividadeId), { notas: notasMap });
}

// ----- Chamada -----
export async function getChamada(uid, turmaId, dateISO){
  const snap = await getDoc(chamadaDoc(uid, turmaId, dateISO));
  return snap.exists() ? (snap.data().registros || {}) : {};
}
export async function saveChamada(uid, turmaId, dateISO, registros){
  await setDoc(chamadaDoc(uid, turmaId, dateISO), { registros }, { merge:true });
}
export async function listChamadaDocs(uid, turmaId){
  const qs = await getDocs(chamadaCol(uid, turmaId));
  return qs.docs.map(d=>({ id: d.id, ...d.data() })); // id = YYYY-MM-DD
}

// ----- Horários do professor -----
export async function listHorarios(uid){
  const qs = await getDocs(query(horariosCol(uid), orderBy("dia"), orderBy("inicio")));
  return qs.docs.map(d=>({ id:d.id, ...d.data() }));
}
export async function addHorario(uid, data){
  const ref = await addDoc(horariosCol(uid), data);
  return { id: ref.id, ...data };
}
export async function deleteHorario(uid, hid){ await deleteDoc(horarioDoc(uid, hid)); }
