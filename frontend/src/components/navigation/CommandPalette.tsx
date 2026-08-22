import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Flame,
  Cpu,
  ShieldCheck,
  Truck,
  Users,
  Package,
  FileText,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Command,
  X
} from 'lucide-react';
import { env } from '../../config/env.config.js';
import { StatusBadge } from '../../design-system/feedback/StatusBadge.js';

interface SearchResultItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  referenceCode: string;
  status?: string;
  actionUrl: string;
  metadata?: Record<string, any>;
}

interface SearchGroup {
  category: string;
  label: string;
  totalMatches: number;
  items: SearchResultItem[];
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  category: string;
  actionUrl: string;
  icon: string;
}

interface SearchResponse {
  query: string;
  category: string;
  totalResults: number;
  groups: SearchGroup[];
  suggestions: string[];
  quickActions: QuickAction[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Domains' },
  { id: 'JOBS', label: 'Jobs & Batches' },
  { id: 'MACHINES', label: 'Furnaces' },
  { id: 'MATERIALS', label: 'Materials' },
  { id: 'HEAT_LOTS', label: 'Heat Lots' },
  { id: 'INSPECTIONS', label: 'QC & NCR' },
  { id: 'DISPATCHES', label: 'Dispatches' }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Focus input on open & reset state
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      fetchQuickActions();
    } else {
      setQuery('');
      setSearchData(null);
    }
  }, [isOpen]);

  const fetchQuickActions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${env.API_BASE_URL}/search/quick-actions`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (res.ok) {
        const json = await res.json();
        setSearchData({
          query: '',
          category: 'ALL',
          totalResults: 0,
          groups: [],
          suggestions: ['JOB-202608', 'FURNACE-VAC-01', 'AISI 4340', 'Inconel 718', 'NCR-202608'],
          quickActions: json.data || []
        });
      }
    } catch {
      // Ignore fallback
    }
  };

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      fetchQuickActions();
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        const catParam = activeCategory !== 'ALL' ? `&category=${activeCategory}` : '';
        const res = await fetch(
          `${env.API_BASE_URL}/search?q=${encodeURIComponent(query)}${catParam}`,
          {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          }
        );
        if (res.ok) {
          const json = await res.json();
          setSearchData(json.data);
          setSelectedIndex(0);
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, activeCategory, isOpen]);

  // Flatten searchable list for keyboard navigation
  const flatItems: { type: 'ACTION' | 'RESULT'; data: any }[] = [];

  if (query.trim() && searchData?.groups) {
    for (const group of searchData.groups) {
      for (const item of group.items) {
        flatItems.push({ type: 'RESULT', data: item });
      }
    }
  } else if (searchData?.quickActions) {
    for (const act of searchData.quickActions) {
      flatItems.push({ type: 'ACTION', data: act });
    }
  }

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = flatItems[selectedIndex];
      if (current) {
        navigate(current.data.actionUrl);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'JOBS':
        return <Flame size={16} color="var(--color-primary)" />;
      case 'MACHINES':
        return <Cpu size={16} color="#3b82f6" />;
      case 'INSPECTIONS':
      case 'NCRS':
        return <ShieldCheck size={16} color="#eab308" />;
      case 'DISPATCHES':
        return <Truck size={16} color="#10b981" />;
      case 'CUSTOMERS':
      case 'EMPLOYEES':
        return <Users size={16} color="#8b5cf6" />;
      case 'MATERIALS':
      case 'HEAT_LOTS':
        return <Package size={16} color="#06b6d4" />;
      default:
        return <FileText size={16} color="var(--color-text-secondary)" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        zIndex: 9999
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <Search size={20} color="var(--color-primary)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search jobs, furnaces, heat lots, materials, QC records, or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#ffffff',
              fontWeight: 500
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          )}
          <kbd
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Domain Category Filter Chips */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(0, 0, 0, 0.2)',
            overflowX: 'auto'
          }}
        >
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                background: activeCategory === tab.id ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: activeCategory === tab.id ? '#ffffff' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Result & Actions Area */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Searching authoritative factory domains...
            </div>
          ) : query.trim() ? (
            /* Search Results */
            searchData?.groups && searchData.groups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {searchData.groups.map((group) => (
                  <div key={group.category}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '8px',
                        paddingLeft: '6px'
                      }}
                    >
                      {group.label} ({group.totalMatches})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {group.items.map((item) => {
                        const itemFlatIndex = flatItems.findIndex(
                          (fi) => fi.type === 'RESULT' && fi.data.id === item.id
                        );
                        const isSelected = itemFlatIndex === selectedIndex;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              navigate(item.actionUrl);
                              onClose();
                            }}
                            onMouseEnter={() => setSelectedIndex(itemFlatIndex)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                              border: isSelected
                                ? '1px solid rgba(37, 99, 235, 0.3)'
                                : '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'rgba(255, 255, 255, 0.04)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {getCategoryIcon(item.category)}
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                  {item.subtitle}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {item.status && (
                                <StatusBadge
                                  status={item.status}
                                  variant={item.status === 'RUNNING' || item.status === 'COMPLETED' ? 'primary' : 'neutral'}
                                  size="sm"
                                />
                              )}
                              <ArrowRight size={14} color={isSelected ? 'var(--color-primary)' : 'transparent'} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <AlertTriangle size={24} style={{ margin: '0 auto 8px', color: '#eab308' }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>No matching records found</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Try searching for a job number, furnace code, material grade, or customer name
                </div>
              </div>
            )
          ) : (
            /* Quick Actions & Common Shortcuts when query is empty */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Search Suggestions */}
              {searchData?.suggestions && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '8px',
                      paddingLeft: '6px'
                    }}
                  >
                    Quick Search Suggestions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {searchData.suggestions.map((sug) => (
                      <button
                        key={sug}
                        onClick={() => setQuery(sug)}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions List */}
              {searchData?.quickActions && searchData.quickActions.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '8px',
                      paddingLeft: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles size={12} color="var(--color-primary)" />
                    Operational Quick Actions
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {searchData.quickActions.map((act, idx) => {
                      const isSelected = idx === selectedIndex;

                      return (
                        <div
                          key={act.id}
                          onClick={() => {
                            navigate(act.actionUrl);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                            border: isSelected
                              ? '1px solid rgba(37, 99, 235, 0.3)'
                              : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.1s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(255, 255, 255, 0.04)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Command size={16} color="var(--color-primary)" />
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                                {act.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {act.description}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {act.shortcut && (
                              <kbd
                                style={{
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  color: 'var(--color-text-muted)'
                                }}
                              >
                                {act.shortcut}
                              </kbd>
                            )}
                            <ArrowRight size={14} color={isSelected ? 'var(--color-primary)' : 'transparent'} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--color-text-muted)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>
              <kbd style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>↵</kbd> Open
            </span>
            <span>
              <kbd style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>ESC</kbd> Close
            </span>
          </div>
          <span>Astralis Global Command Search</span>
        </div>
      </div>
    </div>
  );
};
