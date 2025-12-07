"use client";

import { useState } from "react";
import { DashboardShell } from "@/app/components/layout";
import {
  User,
  Mail,
  Building2,
  MapPin,
  Bell,
  Shield,
  Palette,
  Save,
  Loader2,
} from "lucide-react";

// =============================================================================
// Profile Page
// =============================================================================

export default function ProfilePage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Save profile to Supabase
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <DashboardShell
      title="Profile"
      description="Manage your account settings"
      actions={
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-medium text-sm rounded-lg transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
      }
    >
      <div className="max-w-2xl space-y-6">
        {/* Personal Information */}
        <section className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-hover/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              Personal Information
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  defaultValue="Ben"
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  defaultValue=""
                  placeholder="Your last name"
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                Email Address
              </label>
              <input
                type="email"
                defaultValue="ben@example.com"
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <Building2 className="w-3.5 h-3.5 inline mr-1.5" />
                Company
              </label>
              <input
                type="text"
                placeholder="Your company name"
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1.5" />
                Location
              </label>
              <input
                type="text"
                placeholder="City, State"
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-hover/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <ToggleSetting
              label="Email notifications"
              description="Receive email updates about project activity"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Compliance alerts"
              description="Get notified when compliance issues are detected"
              defaultChecked={true}
            />
            <ToggleSetting
              label="Weekly digest"
              description="Receive a weekly summary of project updates"
              defaultChecked={false}
            />
          </div>
        </section>

        {/* Security */}
        <section className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-hover/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                placeholder="Enter current password"
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-hover/30">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Appearance
            </h2>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium text-foreground mb-3">
              Theme
            </label>
            <div className="flex items-center gap-3">
              <ThemeOption label="Light" selected={false} />
              <ThemeOption label="Dark" selected={true} />
              <ThemeOption label="System" selected={false} />
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

// =============================================================================
// Components
// =============================================================================

function ToggleSetting({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-surface-hover"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ThemeOption({ label, selected }: { label: string; selected: boolean }) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
        selected
          ? "bg-primary/10 border-primary text-primary"
          : "bg-surface-hover border-border text-foreground-muted hover:text-foreground hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );
}
