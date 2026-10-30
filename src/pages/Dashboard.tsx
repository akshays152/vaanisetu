import { Link } from 'react-router-dom';
import { Plus, Search, Users, Languages, CalendarCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, demoMode } from '../services/api';
import type { Agent } from '../types';
import { AgentCard } from '../components/AgentCard';

export function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.listAgents()
      .then(setAgents)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'We couldn’t load your agents. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleAgents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? agents.filter((agent) => `${agent.name} ${agent.purpose} ${agent.language}`.toLowerCase().includes(needle))
      : agents;
  }, [agents, query]);

  const languages = new Set(agents.flatMap((agent) => agent.language.split(/\s*\+\s*/))).size;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Your agents</h1>
          <p>Build, test, and manage voice experiences for your customers.</p>
        </div>
        <Link className="primary-btn" to="/builder"><Plus size={18} /> Create agent</Link>
      </div>

      <div className="stats">
        <div><span><Users size={16} /> Total agents</span><strong>{loading ? '—' : agents.length.toString().padStart(2, '0')}</strong><small>{error ? 'Unavailable' : 'In your workspace'}</small></div>
        <div><span><Languages size={16} /> Language options</span><strong>{loading ? '—' : languages.toString().padStart(2, '0')}</strong><small>Configured across agents</small></div>
        <div><span><CalendarCheck size={16} /> Booking source</span><strong>{loading ? '—' : demoMode ? 'Demo' : error ? 'Unavailable' : 'Backend'}</strong><small>{demoMode ? 'Sample booking flow' : 'Configured for live bookings'}</small></div>
      </div>

      <div className="section-head">
        <h2>All agents <span>{loading ? '—' : visibleAgents.length}</span></h2>
        <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents" /></label>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {loading ? <div className="empty-state">Loading your agents…</div> : (
        <div className="agent-grid">
          {visibleAgents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
          {!query && <Link className="new-card" to="/builder"><span><Plus size={20} /></span><strong>Create a new agent</strong><small>Start with a blank canvas</small></Link>}
          {query && visibleAgents.length === 0 && <div className="empty-state">No agents match “{query}”. Try another search.</div>}
        </div>
      )}
    </div>
  );
}
