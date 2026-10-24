import React from 'react';
import { Link } from 'react-router-dom';
import type { Finding } from '../../services/api';
import { SeverityTag } from './shared';
import { findingLocation } from './helpers';

export const FindingList: React.FC<{ findings: Finding[]; showRepository?: boolean }> = ({ findings, showRepository = false }) => (
  <ul className="divide-y divide-line">
    {findings.map((f) => (
      <li key={f.id}>
        <Link to={`/bugs/${f.id}`} className="flex gap-3 px-5 py-3 hover:bg-wall/70">
          <div className="w-[76px] shrink-0 pt-0.5">
            <SeverityTag severity={f.severity} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">{f.title}</div>
            <div className="mt-0.5 text-xs text-pencil">
              <span className="font-mono">{findingLocation(f)}</span>
              {showRepository && <span>, in {f.repository}</span>}
              <span className="text-faint">
                {' '}
                ({f.analyzer} {f.rule_id})
              </span>
            </div>
          </div>
        </Link>
      </li>
    ))}
  </ul>
);
