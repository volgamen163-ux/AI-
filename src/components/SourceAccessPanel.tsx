import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, LockKeyhole, RefreshCw, Save, ShieldAlert } from "lucide-react";
import {
  SOURCES, REQUEST_STAGES, blankAccess, readSourceAccess, writeSourceAccess,
  type SourceId, type AccessEntry, type RequestStatus,
} from "../lib/source-access";

export function SourceAccessPanel({signedIn,userId}:{signedIn:boolean;userId?:string}){
  const [entries,setEntries]=useState(blankAccess);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState<SourceId|null>(null);
  const [error,setError]=useState("");
  const [confirmation,setConfirmation]=useState<SourceId|null>(null);
  useEffect(()=>{
    let active=true;
    if(!signedIn||!userId){setEntries(blankAccess());return;}
    setLoading(true);setError("");
    void readSourceAccess(userId).then(data=>{if(active)setEntries(data)})
      .catch(e=>{if(active)setError(String(e instanceof Error?e.message:e))})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[signedIn,userId]);
  function change(id:SourceId,field:"request_status"|"reference_number",value:string){
    setConfirmation(null);
    setEntries(old=>({...old,[id]:{...old[id],[field]:value}}));
  }
  async function save(id:SourceId){
    if(!userId||!signedIn)return;
    setError("");setConfirmation(null);setSaving(id);
    try{await writeSourceAccess(userId,entries[id]);setConfirmation(id);}
    catch(e){setError(String(e instanceof Error?e.message:e))}
    finally{setSaving(null)}
  }
  async function refresh(){
    if(!signedIn||!userId)return;
    setError("");setConfirmation(null);setLoading(true);
    try{setEntries(await readSourceAccess(userId))}
    catch(e){setError(String(e instanceof Error?e.message:e))}
    finally{setLoading(false)}
  }
  return (
    <section className="panel" aria-label="Оформление доступов к реестрам" style={{padding:20,marginBottom:20}}>
      <div className="panel-top">
        <h2 style={{display:"flex",alignItems:"center",gap:8}}><ClipboardList size={20}/> Центр официальных доступов</h2>
        <button className="btn line" onClick={()=>void refresh()} disabled={!signedIn||loading}><RefreshCw size={15}/> Обновить</button>
      </div>
      <p className="muted" style={{fontSize:12,lineHeight:1.7}}>
        Здесь сохраняется только ход оформления заявок. Номер обращения не является API-ключом.
        Не вводите пароли, сертификаты, токены или персональные секреты. Статус «доступ предоставлен»
        не означает, что техническая синхронизация прошла проверку.
      </p>
      {!signedIn&&<div className="inline-alert gold"><LockKeyhole size={17}/> Войди в NEXUS, чтобы сохранить и видеть свои заявки. Инструкции доступны ниже без входа.</div>}
      {error&&<div className="inline-alert" role="alert"><ShieldAlert size={16}/>{error}</div>}
      <div style={{display:"grid",gap:12,marginTop:16}}>
        {SOURCES.map(source=>{
          const entry:AccessEntry=entries[source.id];
          return <article key={source.id} style={{border:"1px solid #e2e9ef",borderRadius:15,padding:16,background:"#fcfefd"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div><h3 style={{fontSize:15,margin:"0 0 5px"}}>{source.name}</h3><p className="muted" style={{fontSize:11,margin:0}}>{source.description}</p></div>
              <a href={source.publicUrl} className="btn line" target="_blank" rel="noopener noreferrer">
                Официальный сайт <ExternalLink size={14}/>
              </a>
            </div>
            <div className="two-column" style={{gap:11,marginTop:14}}>
              <label className="field"><span>Этап оформления</span>
                <select value={entry.request_status} disabled={!signedIn||loading||saving!==null}
                  onChange={e=>change(source.id,"request_status",e.target.value as RequestStatus)}>
                  {REQUEST_STAGES.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </label>
              <label className="field"><span>Номер заявки / обращения (не секрет)</span>
                <input value={entry.reference_number} maxLength={120} disabled={!signedIn||loading||saving!==null}
                  placeholder="Необязательно" onChange={e=>change(source.id,"reference_number",e.target.value)}/>
              </label>
            </div>
            <p style={{fontSize:12,lineHeight:1.7,margin:"12px 0 6px"}}><strong>Как получить доступ:</strong> {source.instruction}</p>
            <p className="muted" style={{fontSize:11,lineHeight:1.6}}><strong>Технический способ:</strong> {source.technical}</p>
            <div style={{display:"flex",justifyContent:"space-between",gap:9,alignItems:"center",flexWrap:"wrap",marginTop:14}}>
              <span style={{fontSize:11,color:"#8092a1"}}>{entry.updated_at?"Запись обновлена: "+new Date(entry.updated_at).toLocaleDateString("ru-RU"):"Заявка ещё не сохранена"}</span>
              <button className="btn primary" disabled={!signedIn||loading||saving!==null}
                onClick={()=>void save(source.id)}>
                <Save size={15}/>{saving===source.id?"Сохраняется…":"Сохранить этап"}
              </button>
            </div>
            {confirmation===source.id&&<p role="status" style={{fontSize:11,color:"#217b62",margin:"8px 0 0"}}>
              <CheckCircle2 size={14} style={{display:"inline",verticalAlign:"middle"}}/> Статус сохранён в вашей базе
            </p>}
          </article>
        })}
      </div>
      <p className="muted" style={{fontSize:11,marginTop:15}}>
        После получения официального доступа добавим серверный коннектор, защищённое хранение его секретов,
        тестовый запрос и журнал синхронизации. Само получение доступа не запускает этот процесс автоматически.
      </p>
    </section>
  );
}
