import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Puzzle,
  GitBranch,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Workflow,
  Key,
  Info,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const IntegrationsPage: React.FC = () => {
  const { toast } = useToast();

  const handleConnectGitHub = () => {
    toast(
      'GitHub OAuth Integration (Demo)',
      'GitHub OAuth and Personal Access Token storage will be implemented in a later backend development step. No credentials were requested or stored.',
      'info'
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
          Integrations & Connections
        </h1>
        <p className="text-sm text-[#A1A1AA] mt-1">
          Connect your version control providers, continuous integration triggers, and chat alert channels.
        </p>
      </div>

      {/* Primary GitHub Connection Card */}
      <Card className="p-6 border-[#8B5CF6]/30 bg-gradient-to-br from-[#111114] via-[#111114] to-[#8B5CF6]/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              <GitBranch className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[#FAFAFA]">GitHub Integration</h3>
                <Badge variant="purple">Recommended</Badge>
              </div>
              <p className="text-xs text-[#A1A1AA] max-w-xl leading-relaxed">
                Connect your GitHub organizations to enable automatic repository discovery, webhook event listeners on pull requests, and automated fix branch creation.
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs text-[#71717A]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Read/Write PR Permissions Supported
                </span>
                <span>•</span>
                <span>Webhook events ready</span>
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Key className="w-4 h-4" />}
              onClick={handleConnectGitHub}
            >
              Connect GitHub
            </Button>
          </div>
        </div>

        {/* Demo Callout */}
        <div className="mt-5 p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A] flex items-start gap-2.5 text-xs text-[#A1A1AA]">
          <Info className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
          <p>
            In this frontend-only release, GitHub authentication is presented as an interactive preview. Tokens and secrets are not transmitted or stored on any server.
          </p>
        </div>
      </Card>

      {/* Additional Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slack / Discord Webhooks */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#FAFAFA]">Slack & Discord Alerts</h4>
                  <span className="text-[11px] text-[#71717A]">Channel Notifications</span>
                </div>
              </div>
              <Badge variant="outline" size="sm">Available</Badge>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-3 leading-relaxed">
              Broadcast critical vulnerabilities and fix verifications directly to your team's engineering channels via incoming webhooks.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-[#27272A] flex items-center justify-between">
            <span className="text-xs text-[#71717A]">Webhook payloads formatted</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                toast('Slack Webhook Config', 'Configuration modal will be available in next milestone.', 'info');
              }}
            >
              Configure
            </Button>
          </div>
        </Card>

        {/* GitHub Actions & CI/CD */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#FAFAFA]">CI/CD Workflow Action</h4>
                  <span className="text-[11px] text-[#71717A]">GitHub Actions & GitLab CI</span>
                </div>
              </div>
              <Badge variant="outline" size="sm">Available</Badge>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-3 leading-relaxed">
              Block pull requests when new critical security or reliability bugs are introduced using the TeamPulse CLI action runner.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-[#27272A] flex items-center justify-between">
            <span className="text-xs text-[#71717A]">Action version v1.2.0</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                toast('CI/CD Documentation', 'Pipeline snippets copied to demo clipboard.', 'info');
              }}
            >
              View YAML
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
