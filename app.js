// app.js — UI + Router com responsividade, CRUD completo, bimestres, médias, horários e estatísticas
import {
  auth, watchAuth, loginGoogle, loginEmail, signupEmail, logout,
  ensureUser,
  listTurmas, createTurma, updateTurma, deleteTurma,
  listAlunos, addAluno, updateAluno, deleteAluno,
  listAtividades, addAtividade, getNotas, saveNotas,
  getChamada, saveChamada, listChamadaDocs,
  listHorarios, addHorario, deleteHorario
} from "./db.js";

const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];

const content = $("#content");
const loginScreen = $("#login-screen");
const appEl = $("#app");
const sidebar = $("#sidebar");
const navEl = $("#nav");
const authMsg = $("#authMsg");

function msg(t){ authMsg.textContent = t || ""; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function highlight(path){ $$("[data-route]").forEach(a=>a.classList.toggle("active", a.getAttribute("href")===`#${path}`)); }
function closeSidebarOnMobile(){ if(window.innerWidth<=980) sidebar.classList.remove("open"); }

$("#btnHamburger").onclick = ()=> sidebar.classList.toggle("open");
// fecha menu ao clicar em qualquer item
navEl.addEventListener("click", (e)=>{ const a = e.target.closest("a[data-route]"); if(a){ closeSidebarOnMobile(); }});

let currentUser = null;

/* ======= Login ======= */
$("#btnLoginGoogle").onclick = async ()=>{ try{ await loginGoogle(); }catch(e){ msg(traduz(e)); } };
$("#btnLoginEmail").onclick = async ()=>{
  try{
    msg("Entrando...");
    const email = $("#inpEmail").value.trim();
    const pass  = $("#inpPass").value;
    if(!email || !pass) return msg("Informe e-mail e senha.");
    await loginEmail(email, pass);
    msg("");
  }catch(e){ msg(traduz(e)); }
};
$("#btnSignupEmail").onclick = async ()=>{
  try{
    const email = $("#inpEmail").value.trim();
    const pass  = $("#inpPass").value;
    if(!email || !pass) return msg("Informe e-mail e senha para cadastrar.");
    const nome = prompt("Seu nome para exibir (opcional):") || "Professor";
    await signupEmail(email, pass, nome);
    msg("Conta criada. Você já está logado.");
  }catch(e){ msg(traduz(e)); }
};
$("#btnSair").onclick = async ()=>{ await logout(); location.hash="#/login"; };

// auth watcher
watchAuth(async (user)=>{
  currentUser = user;
  if(user){
    await ensureUser(user.uid, user.displayName);
    $("#perfilNome").textContent = user.displayName || "Professor";
    showApp();
    if(!location.hash || location.hash==="#/login") location.hash = "#/dashboard";
    handleRoute();
  } else {
    showLogin();
    location.hash = "#/login";
  }
});

function showLogin(){ loginScreen.classList.remove("hidden"); appEl.classList.add("hidden"); }
function showApp(){ loginScreen.classList.add("hidden"); appEl.classList.remove("hidden"); }

/* ======= Router ======= */
const routes = {
  "/login": ()=>{},
  "/dashboard": renderDashboard,
  "/turmas": renderTurmas,
  "/alunos": renderAlunosGeral,
  "/turma": p => renderDetalheTurma(p.id),
  "/lancar": p => renderLancarNotas(p.turma, p.atividade),
  "/atividades": renderAtividadesGlobais,
  "/relatorios": renderRelatorios,
  "/estatisticas": renderEstatisticas,
  "/perfil": renderPerfil,
  "/config": renderConfig,
  "/nova-turma": ()=>{ location.hash="#/turmas"; setTimeout(()=> novaTurma(),0); },
  "/chamada": async ()=>{ const ts = await listTurmas(currentUser.uid); if(ts[0]) renderChamadaSelector(ts[0].id); }
};
window.addEventListener("hashchange", handleRoute);
document.addEventListener("DOMContentLoaded", ()=>{ if(!location.hash) location.hash="#/login"; handleRoute(); });

function parseHash(){
  const [path,q] = (location.hash||"#/login").replace("#","").split("?");
  return { path, params: Object.fromEntries(new URLSearchParams(q||"").entries()) };
}
function handleRoute(){
  const { path, params } = parseHash();
  if(path !== "/login" && !auth.currentUser){ showLogin(); return; }
  if(path === "/login"){ showLogin(); (routes[path]||(()=>{}))(params); return; }
  showApp(); (routes[path]||renderDashboard)(params); highlight(path);
}

/* ======= DASHBOARD + HORÁRIOS ======= */
async function renderDashboard(){
  content.innerHTML=""; content.appendChild($("#tpl-dashboard").content.cloneNode(true));
  $("#dashNome").textContent = auth.currentUser?.displayName || "Professor";

  const turmas = await listTurmas(currentUser.uid);
  $("#kpiTurmas").textContent = turmas.length;

  let totalAlunos = 0;
  for(const t of turmas){ totalAlunos += (await listAlunos(currentUser.uid, t.id)).length; }
  $("#kpiAlunos").textContent = totalAlunos;

  let hojeCount = 0;
  for(const t of turmas){
    const atvsHoje = (await listAtividades(currentUser.uid, t.id)).filter(a=>a.data===todayISO());
    hojeCount += atvsHoje.length;
  }
  $("#kpiAtividadesHoje").textContent = hojeCount;

  // Horários
  const tbody = $("#tblHorarios tbody");
  const horarios = await listHorarios(currentUser.uid);
  tbody.innerHTML = "";
  for(const h of horarios){
    const turma = turmas.find(t=>t.id===h.turmaId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${h.dia}</td><td>${h.inicio}</td><td>${h.fim}</td>
      <td>${turma ? turma.nome : "-"}</td>
      <td>${h.disciplina||"-"}</td>
      <td><button class="action" data-del="${h.id}">Excluir</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.addEventListener("click", async (e)=>{
    const id = e.target.dataset.del;
    if(id && confirm("Excluir horário?")){ await deleteHorario(currentUser.uid, id); renderDashboard(); }
  });

  $("#btnNovoHorario").onclick = async ()=>{
    if(!turmas.length){ alert("Crie uma turma antes."); return; }
    const dia = prompt("Dia (ex: Segunda)"); if(!dia) return;
    const inicio = prompt("Início (HH:MM)","07:00"); if(!inicio) return;
    const fim = prompt("Fim (HH:MM)","07:50"); if(!fim) return;
    const turmaNome = prompt("Turma (digite o nome exatamente como cadastrado)","");
    const turmaSel = turmas.find(t=>t.nome===turmaNome) || turmas[0];
    const disciplina = prompt("Disciplina","Matemática") || "Matemática";
    await addHorario(currentUser.uid, { dia, inicio, fim, turmaId: turmaSel.id, disciplina });
    renderDashboard();
  };
}

/* ======= TURMAS (CRUD) ======= */
async function renderTurmas(){
  content.innerHTML=""; content.appendChild($("#tpl-turmas").content.cloneNode(true));
  $("#btnNovaTurma").onclick = novaTurma;

  const list = $("#listaTurmas");
  const turmas = await listTurmas(currentUser.uid);
  list.innerHTML="";
  turmas.forEach(t=>{
    const row=document.createElement("div"); row.className="row";
    row.innerHTML=`
      <div>
        <div class="row-title">${t.nome}</div>
        <div class="row-sub">${t.serie} • ${t.turno}</div>
      </div>
      <div class="row-actions">
        <a class="action" href="#/turma?id=${t.id}">Ver</a>
        <button class="action" data-edit="${t.id}">Editar</button>
        <button class="action" data-del="${t.id}">Excluir</button>
      </div>`;
    list.appendChild(row);
  });

  list.onclick = async (e)=>{
    const tid = e.target.dataset.edit;
    if(tid){
      const t = turmas.find(x=>x.id===tid);
      const nome  = prompt("Nome da turma:", t.nome) || t.nome;
      const serie = prompt("Série:", t.serie) || t.serie;
      const turno = prompt("Turno:", t.turno) || t.turno;
      await updateTurma(currentUser.uid, tid, { nome, serie, turno });
      renderTurmas(); return;
    }
    const del = e.target.dataset.del;
    if(del && confirm("Excluir turma? (alunos/atividades não são apagados nesta versão)")){
      await deleteTurma(currentUser.uid, del);
      renderTurmas();
    }
  };
}
async function novaTurma(){
  const nome  = prompt("Nome da turma:"); if(!nome) return;
  const serie = prompt("Série:","2ª série") || "2ª série";
  const turno = prompt("Turno:","Manhã") || "Manhã";
  await createTurma(currentUser.uid, { nome, serie, turno });
  renderTurmas();
}

/* ======= ALUNOS (GERAL) ======= */
async function renderAlunosGeral(){
  content.innerHTML=""; content.appendChild($("#tpl-alunos").content.cloneNode(true));
  const wrap = $("#wrapAlunosPorTurma");
  wrap.innerHTML = "";
  const turmas = await listTurmas(currentUser.uid);

  for(const t of turmas){
    const box = document.createElement("div");
    box.className = "card";
    box.innerHTML = `<h3>${t.nome} — ${t.serie} • ${t.turno}</h3>
      <div class="row-actions mb-12">
        <button class="action" data-add="${t.id}">+ Inserir aluno</button>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>#</th><th>Nome</th><th>Ações</th></tr></thead>
          <tbody id="tb-${t.id}"></tbody>
        </table>
      </div>`;
    wrap.appendChild(box);

    const alunos = (await listAlunos(currentUser.uid, t.id)).sort((a,b)=>a.nome.localeCompare(b.nome));
    const tbody = box.querySelector("tbody");
    alunos.forEach((a,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td><td>${a.nome}</td>
        <td>
          <button class="action" data-edit="${t.id}:${a.id}">Editar</button>
          <button class="action" data-del="${t.id}:${a.id}">Excluir</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  wrap.onclick = async (e)=>{
    if(e.target.dataset.add){
      const tid = e.target.dataset.add;
      const nome = prompt("Nome do aluno:"); if(!nome) return;
      await addAluno(currentUser.uid, tid, nome);
      renderAlunosGeral(); return;
    }
    if(e.target.dataset.edit){
      const [tid, aid] = e.target.dataset.edit.split(":");
      const alunos = await listAlunos(currentUser.uid, tid);
      const a = alunos.find(x=>x.id===aid);
      const nome = prompt("Editar nome:", a.nome) || a.nome;
      await updateAluno(currentUser.uid, tid, aid, { nome });
      renderAlunosGeral(); return;
    }
    if(e.target.dataset.del){
      const [tid, aid] = e.target.dataset.del.split(":");
      if(confirm("Excluir aluno?")){ await deleteAluno(currentUser.uid, tid, aid); renderAlunosGeral(); }
    }
  };
}

/* ======= DETALHE DA TURMA: alunos/atividades/chamada ======= */
async function renderDetalheTurma(turmaId, initialTab="alunos"){
  content.innerHTML=""; content.appendChild($("#tpl-detalhe-turma").content.cloneNode(true));
  $("#nomeUsuarioTop").textContent = auth.currentUser?.displayName || "Professor";

  const turmas = await listTurmas(currentUser.uid);
  const turma = turmas.find(t=>t.id===turmaId) || turmas[0];
  $("#tituloTurma").textContent = `${turma.nome} – ${turma.serie} – ${turma.turno}`;

  // tabs
  $$(".tab").forEach(btn=>{
    btn.onclick=()=>{
      $$(".tab").forEach(b=>b.classList.remove("active"));
      $$(".tabpane").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      $(`#pane${btn.dataset.tab.charAt(0).toUpperCase()+btn.dataset.tab.slice(1)}`).classList.add("active");
    };
  });
  if(initialTab!=="alunos") $(`.tab[data-tab="${initialTab}"]`).click();

  // Alunos (CRUD dentro da turma)
  await renderAlunosTurmaSection(turma);

  // Atividades + bimestre
  const selBim = $("#selBimAtiv");
  selBim.onchange = ()=> renderAtividadesTurma(turma.id, selBim.value);
  await renderAtividadesTurma(turma.id, selBim.value);

  // Chamada (data livre)
  const dateInp = $("#chamadaDate");
  dateInp.value = todayISO();
  await renderChamadaList(turma.id, dateInp.value);
  dateInp.onchange = ()=> renderChamadaList(turma.id, dateInp.value);
  $("#btnSalvarChamada").onclick = async ()=>{
    const registros = collectChamadaFromUI();
    await saveChamada(currentUser.uid, turma.id, dateInp.value, registros);
    alert("Chamada salva!");
  };
}

async function renderAlunosTurmaSection(turma){
  const lista = $("#listaAlunos"); lista.innerHTML="";
  const alunos = (await listAlunos(currentUser.uid, turma.id)).sort((a,b)=>a.nome.localeCompare(b.nome));
  alunos.forEach(a=>{
    const row=document.createElement("div"); row.className="row";
   
