import { useEffect, useRef, useState } from 'react';
import { ACCOUNT_TYPES, MAX_ACCOUNTS, projectAccounts, type Account } from './projection';

type Draft = Omit<Account, 'balance' | 'priceGrowth' | 'incomeYield' | 'monthlyContribution'> & {
  balance: string; priceGrowth: string; incomeYield: string; monthlyContribution: string;
};
const draftOf = (a: Account): Draft => ({...a, balance: String(a.balance), priceGrowth: String(a.priceGrowth), incomeYield: String(a.incomeYield), monthlyContribution: String(a.monthlyContribution)});
const numericFields = [
  {key:'balance', label:'Current balance ($)', min:0, max:1e9, step:'any'},
  {key:'monthlyContribution', label:'Monthly contribution ($)', min:0, max:1e7, step:'any'},
  {key:'priceGrowth', label:'Annual price growth (%)', min:-99, max:30, step:'any'},
  {key:'incomeYield', label:'Annual dividend / interest (%)', min:0, max:30, step:'any'},
] as const;

export function AccountsDialog({accounts, onSave, onClose}: {accounts:Account[]; onSave:(accounts:Account[])=>void; onClose:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [drafts,setDrafts] = useState(() => accounts.map(draftOf));
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  useEffect(() => { const element=dialog.current!; element.showModal(); return () => element.close(); }, []);
  function update(id:string, patch:Partial<Draft>) {setDrafts(items=>items.map(a=>a.id===id?{...a,...patch}:a));setError('');}
  function save(e:React.FormEvent) {
    e.preventDefault();
    try {
      if (drafts.some(a=>numericFields.some(f=>a[f.key].trim()===''))) throw new Error('Fill in every numeric field; use 0 when needed.');
      const next=drafts.map(a=>({...a,name:a.name.trim(),balance:Number(a.balance),monthlyContribution:Number(a.monthlyContribution),priceGrowth:Number(a.priceGrowth),incomeYield:Number(a.incomeYield)}));
      projectAccounts(next,0);
      onSave(next);
    } catch(e) { setError(e instanceof Error?e.message:'Check your account details.'); }
  }
  return <dialog ref={dialog} className="accounts-dialog" aria-labelledby="accounts-title" aria-describedby="accounts-description" onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>{
    if(e.key!=='Tab') return;
    const controls=Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
    const first=controls[0],last=controls.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }}>
    <form onSubmit={save}>
      <div className="drawer-header"><div><p className="eyebrow">YOUR SAVINGS SOURCES</p><h2 id="accounts-title">Configure accounts</h2></div><button type="button" className="secondary" onClick={onClose} aria-label="Close account configurator">Close</button></div>
      <div className="drawer-body"><p id="accounts-description">Set each account’s balance, monthly contribution and annual rates. Changes apply when you save.</p>
        <div className="rate-note">Price growth excludes dividends and interest. We add the yield to price growth, then convert that total annual return to a monthly rate. All income is reinvested. If your rate already includes income, enter it as growth and set yield to 0. For cash, use growth 0 and your assumed interest rate as yield.</div>
        <p className="muted small">Account type is a label in Savings growth. Retirement cashflow uses simplified access and tax rules; set its additional basis/access assumptions there. Contribution limits are not checked.</p>
        {drafts.map((a,index)=><fieldset className="account-editor" key={a.id}><legend>Account {index+1}</legend><div className="account-editor-heading"><strong>{a.name || `Account ${index+1}`}</strong><button type="button" className="remove" disabled={drafts.length===1} aria-label={`Remove ${a.name || `account ${index+1}`}`} onClick={()=>{setDrafts(items=>items.filter(item=>item.id!==a.id));setError('');setNotice(`${a.name || 'Account'} removed from draft.`);addButton.current?.focus();}}>Remove</button></div>
          <div className="account-fields"><div className="field"><label htmlFor={`${a.id}-name`}>Account name</label><input id={`${a.id}-name`} value={a.name} maxLength={60} required onChange={e=>update(a.id,{name:e.target.value})}/></div>
          <div className="field"><label htmlFor={`${a.id}-type`}>Account type</label><select id={`${a.id}-type`} value={a.type} onChange={e=>update(a.id,{type:e.target.value as Account['type']})}>{ACCOUNT_TYPES.map(type=><option key={type}>{type}</option>)}</select></div>
          {numericFields.map(f=><div className="field" key={f.key}><label htmlFor={`${a.id}-${f.key}`}>{f.label}</label><input id={`${a.id}-${f.key}`} type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} required value={a[f.key]} onChange={e=>update(a.id,{[f.key]:e.target.value})}/></div>)}</div>
          <p className="hint">End-of-month contributions · Combined annual return must be −99% to 30%.</p>
        </fieldset>)}
        <button type="button" ref={addButton} className="secondary add-account" disabled={drafts.length>=MAX_ACCOUNTS} onClick={()=>{const id=crypto.randomUUID();setDrafts(items=>[...items,draftOf({id,name:`Account ${items.length+1}`,type:'Taxable brokerage',balance:0,monthlyContribution:0,priceGrowth:0,incomeYield:0})]);setNotice('Account added.');requestAnimationFrame(()=>document.getElementById(`${id}-name`)?.focus());}}>Add account</button><span className="account-count">{drafts.length} / {MAX_ACCOUNTS} accounts</span>
        <p className="sr-only" role="status">{notice}</p>
      </div>
      <div className="drawer-footer">{error&&<p className="form-error" role="alert">{error}</p>}<div className="drawer-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary">Save accounts</button></div></div>
    </form>
  </dialog>;
}
