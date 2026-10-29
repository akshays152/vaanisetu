import { Link } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../services/api';
import type { Agent } from '../types';
import { AgentCard } from '../components/AgentCard';

export function Dashboard(){
  const [agents,setAgents]=useState<Agent[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{api.listAgents().then(setAgents).catch((e:unknown)=>setError(e instanceof ApiError?e.message:'Could not load agents.')).finally(()=>setLoading(false))},[]);
  return <div className="page"><div className="page-head"><div><div className="eyebrow">WORKSPACE OVERVIEW</div><h1>Your agents</h1><p>Build, test, and launch voice experiences that work for everyone.</p></div><Link className="primary-btn" to="/builder"><Plus size={18}/> Create agent</Link></div><div className="stats"><div><span><Users size={16}/> Total agents</span><strong>{loading?'—':agents.length.toString().padStart(2,'0')}</strong><small>{error?'Unavailable':'↑ Ready to use'}</small></div><div><span>◉ Active sessions</span><strong>01</strong><small>Demo session</small></div><div><span>◷ This month</span><strong>24</strong><small>Conversations</small></div></div><div className="section-head"><h2>All agents <span>{agents.length}</span></h2><div className="search"><Search size={16}/><input placeholder="Search agents"/></div></div>{error&&<div className="error-banner">{error}</div>}{loading?<div className="empty-state">Loading agents…</div>:<div className="agent-grid">{agents.map(a=><AgentCard key={a.id} agent={a}/>)}<Link className="new-card" to="/builder"><span><Plus size={20}/></span><strong>Create a new agent</strong><small>Start with a blank canvas</small></Link></div>}</div>
}
