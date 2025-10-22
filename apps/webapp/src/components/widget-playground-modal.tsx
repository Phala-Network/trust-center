'use client'

import {useState} from 'react'
import {Copy} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Separator} from '@/components/ui/separator'
import {Input} from '@/components/ui/input'
import {useAttestationData} from '@/components/attestation-data-context'
import CompactReportWidget, {
  type CompactReportWidgetConfig,
} from '@/components/visualization/compact-report-widget'

interface WidgetPlaygroundModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  widgetUrl: string
}

type WidgetConfig = Required<CompactReportWidgetConfig>

const defaultConfig: WidgetConfig = {
  showHeader: true,
  showAttributes: true,
  showVerificationStatus: true,
  defaultExpanded: false,
  showSectionContent: true,
  customAppName: undefined,
  customAppUser: undefined,
  sections: {
    hardware: true,
    sourceCode: true,
    zeroTrust: true,
    os: true,
    authority: true,
  },
}

export default function WidgetPlaygroundModal({
  open,
  onOpenChange,
  widgetUrl,
}: WidgetPlaygroundModalProps) {
  const [config, setConfig] = useState<WidgetConfig>(defaultConfig)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const {attestationData} = useAttestationData()

  const updateConfig = (key: keyof WidgetConfig, value: boolean) => {
    setConfig((prev) => ({...prev, [key]: value}))
  }

  const updateSection = (
    section: keyof WidgetConfig['sections'],
    value: boolean,
  ) => {
    setConfig((prev) => ({
      ...prev,
      sections: {...prev.sections, [section]: value},
    }))
  }

  const updateCustomText = (key: 'customAppName' | 'customAppUser', value: string) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value || undefined,
    }))
  }

  // Generate optimized config (only include non-default values)
  const getOptimizedConfig = () => {
    const optimized: Partial<WidgetConfig> = {}

    if (!config.showHeader) optimized.showHeader = false
    if (!config.showAttributes) optimized.showAttributes = false
    if (!config.showVerificationStatus) optimized.showVerificationStatus = false
    if (config.defaultExpanded) optimized.defaultExpanded = true
    if (!config.showSectionContent) optimized.showSectionContent = false
    if (config.customAppName) optimized.customAppName = config.customAppName
    if (config.customAppUser) optimized.customAppUser = config.customAppUser

    // Only include sections if any are disabled
    const anySectionDisabled = Object.values(config.sections).some(v => !v)
    if (anySectionDisabled) {
      optimized.sections = Object.entries(config.sections)
        .filter(([_, enabled]) => !enabled)
        .reduce((acc, [key, _]) => ({...acc, [key]: false}), {})
    }

    return optimized
  }

  const optimizedConfig = getOptimizedConfig()
  const configParam = Object.keys(optimizedConfig).length > 0
    ? `?config=${encodeURIComponent(JSON.stringify(optimizedConfig))}`
    : ''

  // Generate embed code
  const embedCode = `<iframe
  src="${typeof window !== 'undefined' ? window.location.origin : ''}${widgetUrl}${configParam}"
  width="100%"
  height="800"
  frameborder="0"
></iframe>`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Widget Playground</DialogTitle>
          <DialogDescription>
            Customize the report widget and preview it in real-time
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 overflow-y-auto flex-1 min-h-0">
          {/* Control Panel - Left Side */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-4">
                Widget Configuration
              </h3>
              <Separator />
            </div>

            {/* Card Display Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Card Display
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="default-expanded" className="text-sm">
                  Always Expand Cards
                </Label>
                <Switch
                  id="default-expanded"
                  checked={config.defaultExpanded}
                  onCheckedChange={(checked) =>
                    updateConfig('defaultExpanded', checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Theme Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Theme
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode" className="text-sm">
                  Dark Mode
                </Label>
                <Switch
                  id="dark-mode"
                  checked={isDarkMode}
                  onCheckedChange={setIsDarkMode}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-demo" className="text-sm">
                  Show Demo Page
                </Label>
                <Switch
                  id="show-demo"
                  checked={showDemo}
                  onCheckedChange={setShowDemo}
                />
              </div>
            </div>

            <Separator />

            {/* Header Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Header Components
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-attributes" className="text-sm">
                  Show Attributes
                </Label>
                <Switch
                  id="show-attributes"
                  checked={config.showAttributes}
                  onCheckedChange={(checked) =>
                    updateConfig('showAttributes', checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Customization Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Customization
              </h4>

              <div className="space-y-2">
                <Label htmlFor="custom-app-name" className="text-sm">
                  Custom App Name
                </Label>
                <Input
                  id="custom-app-name"
                  type="text"
                  placeholder="Leave empty to use original"
                  value={config.customAppName || ''}
                  onChange={(e) => updateCustomText('customAppName', e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-app-user" className="text-sm">
                  Custom App User
                </Label>
                <Input
                  id="custom-app-user"
                  type="text"
                  placeholder="Leave empty to use original"
                  value={config.customAppUser || ''}
                  onChange={(e) => updateCustomText('customAppUser', e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* Section Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Trust Sections
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="section-hardware" className="text-sm">
                  TEE Hardware
                </Label>
                <Switch
                  id="section-hardware"
                  checked={config.sections.hardware}
                  onCheckedChange={(checked) =>
                    updateSection('hardware', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="section-source" className="text-sm">
                  Source Code
                </Label>
                <Switch
                  id="section-source"
                  checked={config.sections.sourceCode}
                  onCheckedChange={(checked) =>
                    updateSection('sourceCode', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="section-network" className="text-sm">
                  Network Encryption
                </Label>
                <Switch
                  id="section-network"
                  checked={config.sections.zeroTrust}
                  onCheckedChange={(checked) =>
                    updateSection('zeroTrust', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="section-os" className="text-sm">
                  Operating System
                </Label>
                <Switch
                  id="section-os"
                  checked={config.sections.os}
                  onCheckedChange={(checked) => updateSection('os', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="section-authority" className="text-sm">
                  Root-of-Trust
                </Label>
                <Switch
                  id="section-authority"
                  checked={config.sections.authority}
                  onCheckedChange={(checked) =>
                    updateSection('authority', checked)
                  }
                />
              </div>

              <Separator className="my-3" />

              <div className="flex items-center justify-between">
                <Label htmlFor="show-section-content" className="text-sm">
                  Show Card Details
                </Label>
                <Switch
                  id="show-section-content"
                  checked={config.showSectionContent}
                  onCheckedChange={(checked) =>
                    updateConfig('showSectionContent', checked)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setConfig(defaultConfig)}
              >
                Reset to Default
              </Button>
            </div>
          </div>

          {/* Preview Panel - Right Side */}
          <div className="flex flex-col lg:col-span-2">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Widget Preview</h3>
              <p className="text-xs text-muted-foreground">
                Live preview of your customized report widget
              </p>
            </div>

            <Separator className="mb-4" />

            <div className={isDarkMode ? 'dark' : ''}>
              {showDemo ? (
                <div className="border border-border rounded-lg bg-background overflow-hidden h-[600px] flex flex-col">
                  {/* AI Chat App Header */}
                  <div className="border-b bg-card px-4 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <div className="h-4 w-4 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* Chat Messages - Left Side */}
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                          <div className="h-4 w-48 bg-primary-foreground/20 rounded animate-pulse" />
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="flex justify-start">
                        <div className="max-w-[80%] bg-muted rounded-lg px-4 py-3 space-y-2">
                          <div className="h-3 w-full bg-muted-foreground/20 rounded animate-pulse" />
                          <div className="h-3 w-5/6 bg-muted-foreground/20 rounded animate-pulse" />
                          <div className="h-3 w-4/6 bg-muted-foreground/20 rounded animate-pulse" />
                        </div>
                      </div>

                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg px-4 py-2">
                          <div className="h-4 w-36 bg-primary-foreground/20 rounded animate-pulse" />
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="flex justify-start">
                        <div className="max-w-[80%] bg-muted rounded-lg px-4 py-3 space-y-2">
                          <div className="h-3 w-full bg-muted-foreground/20 rounded animate-pulse" />
                          <div className="h-3 w-4/5 bg-muted-foreground/20 rounded animate-pulse" />
                          <div className="h-3 w-3/5 bg-muted-foreground/20 rounded animate-pulse" />
                          <div className="h-3 w-5/6 bg-muted-foreground/20 rounded animate-pulse" />
                        </div>
                      </div>
                    </div>

                    {/* Widget Sidebar - Right Side */}
                    <div className="w-80 border-l bg-card/50 p-4 overflow-y-auto">
                      {attestationData && attestationData.length > 0 ? (
                        <CompactReportWidget config={config} />
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <p>Loading...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat Input - Bottom */}
                  <div className="border-t bg-card p-4">
                    <div className="flex gap-2">
                      <div className="flex-1 h-10 bg-muted rounded-lg animate-pulse" />
                      <div className="h-10 w-10 bg-primary/20 rounded-lg animate-pulse" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-lg bg-card shadow-sm overflow-auto flex-1 p-4">
                  {attestationData && attestationData.length > 0 ? (
                    <CompactReportWidget config={config} />
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <p>Loading attestation data...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Embed Code - Bottom Fixed Section */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-sm font-semibold">Embed Code</Label>
          <div className="relative mt-2">
            <pre className="text-xs bg-secondary text-secondary-foreground p-3 rounded-md overflow-x-auto max-h-24">
              <code>{embedCode}</code>
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 h-7 w-7 p-0"
              onClick={() => {
                navigator.clipboard.writeText(embedCode)
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
