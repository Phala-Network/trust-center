'use client'

import {useState} from 'react'
import {Check, Copy} from 'lucide-react'

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
  const [copied, setCopied] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const {attestationData} = useAttestationData()

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

  // Generate embed code
  const embedCode = `<iframe
  src="${typeof window !== 'undefined' ? window.location.origin : ''}${widgetUrl}?config=${encodeURIComponent(JSON.stringify(config))}"
  width="100%"
  height="800"
  frameborder="0"
></iframe>`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Widget Playground</DialogTitle>
          <DialogDescription>
            Customize the report widget and preview it in real-time
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 overflow-y-auto flex-1 min-h-0">
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
            </div>

            <Separator />

            {/* Header Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Header Components
              </h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-header" className="text-sm">
                  Show Header
                </Label>
                <Switch
                  id="show-header"
                  checked={config.showHeader}
                  onCheckedChange={(checked) =>
                    updateConfig('showHeader', checked)
                  }
                />
              </div>

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

              <div className="flex items-center justify-between">
                <Label htmlFor="show-verification" className="text-sm">
                  Show Verification Status
                </Label>
                <Switch
                  id="show-verification"
                  checked={config.showVerificationStatus}
                  onCheckedChange={(checked) =>
                    updateConfig('showVerificationStatus', checked)
                  }
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
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyConfig}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Configuration
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setConfig(defaultConfig)}
              >
                Reset to Default
              </Button>
            </div>

            {/* Embed Code */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Embed Code</Label>
              <div className="relative">
                <pre className="text-xs bg-secondary text-secondary-foreground p-3 rounded-md overflow-x-auto max-h-32">
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
          </div>

          {/* Preview Panel - Right Side */}
          <div className="flex flex-col">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Widget Preview</h3>
              <p className="text-xs text-muted-foreground">
                Live preview of your customized report widget
              </p>
            </div>

            <Separator className="mb-4" />

            <div className={isDarkMode ? 'dark' : ''}>
              <div className="border border-border rounded-lg bg-card shadow-sm overflow-auto flex-1 p-4">
                {attestationData && attestationData.length > 0 ? (
                  <CompactReportWidget config={config} />
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <p>Loading attestation data...</p>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
