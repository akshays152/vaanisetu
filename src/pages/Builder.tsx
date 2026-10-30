import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, Info, Save, Sparkles, Wand2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { demoAgent } from '../data/demo';
import { Field } from '../components/Field';
import type { Agent } from '../types';

export function Builder() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState<Agent>(demoAgent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const formRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.getAgent(id).then((agent) => { if (!cancelled) setForm(agent); })
      .catch((cause: Error) => { if (!cancelled) setError(cause.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const update = (key: keyof Agent, value: string | boolean) => setForm((previous) => ({ ...previous, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const agent = id ? await api.updateAgent(id, form) : await api.createAgent(form);
      nav(`/test/${agent.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this agent.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page builder"><p>Loading agent…</p></div>;

  return <div className="page builder">
    <Link to="/dashboard" className="back"><ArrowLeft size={16} /> Back to agents</Link>
    <div className="builder-head">
      <div><div className="eyebrow">{id ? 'EDIT AGENT' : 'NEW AGENT'}</div><h1>{id ? 'Shape your agent.' : 'Create an agent.'}</h1><p>Give it the context to be helpful and the personality to be remembered.</p></div>
      <div className="builder-actions">
        <button type="button" className="secondary-btn" onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Eye size={16} /> Preview</button>
        <button type="button" className="primary-btn" disabled={saving} onClick={() => formRef.current?.requestSubmit()}><Save size={16} /> {saving ? 'Saving…' : 'Save & test'}</button>
      </div>
    </div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="builder-layout">
      <form ref={formRef} onSubmit={submit} className="form-card">
        <div className="form-section">
          <div className="section-title"><span className="step-num">01</span><div><h2>Core details</h2><p>Start with the basics of your voice agent.</p></div></div>
          <Field label="Agent name" required><input required value={form.name} onChange={(event) => update('name', event.target.value)} maxLength={60} /></Field>
          <Field label="What should it help with?" required help="Keep it clear and specific."><textarea required value={form.purpose} onChange={(event) => update('purpose', event.target.value)} maxLength={180} /></Field>
          <div className="split">
            <Field label="Primary language" required><select value={form.language} onChange={(event) => update('language', event.target.value)}><option>Hindi + English</option><option>English</option><option>Hindi</option></select></Field>
            <Field label="Voice"><select value={form.voice} onChange={(event) => update('voice', event.target.value)}><option>Riya — Warm & clear</option><option>Arjun — Calm & assured</option><option>Sarah — Friendly & bright</option></select></Field>
          </div>
          <label className="toggle-row"><span><strong>Bilingual mode</strong><small>Allow the agent to naturally switch between Hindi and English.</small></span><input type="checkbox" checked={form.bilingual} onChange={(event) => update('bilingual', event.target.checked)} /><i /></label>
        </div>
        <div className="form-section">
          <div className="section-title"><span className="step-num">02</span><div><h2>Agent behavior</h2><p>Tell your agent how to show up in every conversation.</p></div></div>
          <Field label="Instructions" required help={`${form.instructions.length}/800 characters`}><textarea required className="tall" value={form.instructions} onChange={(event) => update('instructions', event.target.value)} maxLength={800} /></Field>
          <Field label="Opening greeting" required help="This is the first thing callers will hear."><textarea required value={form.greeting} onChange={(event) => update('greeting', event.target.value)} maxLength={240} /></Field>
          <Field label="Additional context" help="Hours, policies, FAQs, or other useful details."><textarea value={form.context} onChange={(event) => update('context', event.target.value)} maxLength={600} /></Field>
        </div>
      </form>
      <aside ref={previewRef} className="preview-card" tabIndex={-1}>
        <div className="preview-label"><span><Sparkles size={15} /> LIVE PREVIEW</span><span className="status active"><i /> Ready</span></div>
        <div className="preview-agent"><div className="avatar large">{form.name.slice(0, 1) || 'A'}</div><h3>{form.name || 'Your new agent'}</h3><p>{form.purpose || 'Your agent’s purpose will appear here.'}</p></div>
        <div className="preview-bubble"><small>GREETING</small><p>{form.greeting || 'Add a greeting to preview it here.'}</p></div>
        <div className="preview-note"><Info size={16} /><span>Changes appear here as you type. Save to try the full conversation.</span></div>
        {id ? <Link className="try-link" to={`/test/${id}`}>Try the text demo <Wand2 size={15} /></Link> : <button type="button" className="try-link" onClick={() => formRef.current?.requestSubmit()}>Save to test this agent <Wand2 size={15} /></button>}
      </aside>
    </div>
  </div>;
}
