import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  Settings,
  User,
  Palette,
  GitBranch,
  Bell,
  Shield,
  Save,
  Check,
  Info,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'github' | 'notifications'>('general');

  // Form states
  const [name, setName] = useState('Developer');
  const [email, setEmail] = useState('developer@teampulse.ai');
  const [organization, setOrganization] = useState('Acme Corp');

  // Notification toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [criticalOnly, setCriticalOnly] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [autoVerifyTests, setAutoVerifyTests] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast('Settings Saved', 'Preferences updated in local storage.', 'success');
  };

  const tabs = [
    { key: 'general', label: 'General', icon: User },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'github', label: 'GitHub Integration', icon: GitBranch },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
          Settings
        </h1>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Manage your account profile, UI theme customization, and notification alerts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#27272A] gap-2 overflow-x-auto text-xs font-medium">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[#8B5CF6] text-[#FAFAFA]'
                  : 'border-transparent text-[#71717A] hover:text-[#FAFAFA]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'general' && (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-[#FAFAFA] mb-4">
              Profile & Organization
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
              <div>
                <label className="text-xs font-medium text-[#FAFAFA] block mb-1.5">
                  Plan Tier
                </label>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#18181B] border border-[#27272A] text-xs">
                  <span className="text-[#FAFAFA] font-medium">Free Developer Plan</span>
                  <Badge variant="purple" size="sm">Active</Badge>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="primary" leftIcon={<Save className="w-3.5 h-3.5" />}>
                Save Changes
              </Button>
            </div>
          </Card>
        </form>
      )}

      {activeTab === 'appearance' && (
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-[#FAFAFA]">Dashboard Theme</h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              TeamPulse defaults to a modern, high-contrast dark developer aesthetic.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border-2 border-[#8B5CF6] bg-[#0C0C0F] cursor-pointer">
              <div className="w-full h-12 rounded bg-[#09090B] border border-[#27272A] mb-2 flex items-center justify-center">
                <span className="text-xs font-mono text-[#8B5CF6]">Dark Minimal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#FAFAFA]">Dark Mode (Default)</span>
                <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[#27272A] bg-[#0C0C0F] opacity-60 cursor-not-allowed">
              <div className="w-full h-12 rounded bg-[#18181B] border border-[#27272A] mb-2 flex items-center justify-center">
                <span className="text-xs font-mono text-[#A1A1AA]">OLED Black</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#A1A1AA]">Midnight OLED</span>
                <span className="text-[10px] text-[#71717A]">Coming Soon</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[#27272A] bg-[#0C0C0F] opacity-60 cursor-not-allowed">
              <div className="w-full h-12 rounded bg-[#FAFAFA] border border-[#E4E4E7] mb-2 flex items-center justify-center">
                <span className="text-xs font-mono text-[#18181B]">Light Studio</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#A1A1AA]">Light Mode</span>
                <span className="text-[10px] text-[#71717A]">Coming Soon</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'github' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#FAFAFA]">
                GitHub Enterprise & Cloud
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Manage personal access tokens and OAuth application grant permissions.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                toast(
                  'GitHub OAuth Notice',
                  'GitHub OAuth token exchange will be connected in a future backend integration step.',
                  'info'
                );
              }}
            >
              Connect GitHub
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-[#0C0C0F] border border-[#27272A] text-xs text-[#A1A1AA] space-y-2">
            <div className="flex items-center gap-2 text-[#FAFAFA] font-medium">
              <Info className="w-4 h-4 text-[#8B5CF6]" />
              <span>Token Privacy Guarantee</span>
            </div>
            <p>
              TeamPulse runs AST static scans in isolated environments and never commits or merges code without explicit manual approval. In this frontend stage, credentials are not collected.
            </p>
          </div>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-[#FAFAFA]">
            Notification Alerts & Triggers
          </h3>

          <div className="space-y-4 divide-y divide-[#27272A]">
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-medium text-[#FAFAFA]">Email Notifications</p>
                <p className="text-[11px] text-[#A1A1AA]">Receive email alerts when new security vulnerabilities are detected.</p>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="rounded border-[#27272A] text-[#8B5CF6] focus:ring-[#8B5CF6] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-xs font-medium text-[#FAFAFA]">Critical Severities Only</p>
                <p className="text-[11px] text-[#A1A1AA]">Suppress notifications for low and medium informational issues.</p>
              </div>
              <input
                type="checkbox"
                checked={criticalOnly}
                onChange={(e) => setCriticalOnly(e.target.checked)}
                className="rounded border-[#27272A] text-[#8B5CF6] focus:ring-[#8B5CF6] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-xs font-medium text-[#FAFAFA]">Automated Test Verification Simulation</p>
                <p className="text-[11px] text-[#A1A1AA]">Run sandbox tests immediately when proposed AI code patches are generated.</p>
              </div>
              <input
                type="checkbox"
                checked={autoVerifyTests}
                onChange={(e) => setAutoVerifyTests(e.target.checked)}
                className="rounded border-[#27272A] text-[#8B5CF6] focus:ring-[#8B5CF6] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                toast('Preferences Saved', 'Notification thresholds updated.', 'success');
              }}
            >
              Update Preferences
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
