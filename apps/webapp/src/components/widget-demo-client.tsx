interface WidgetDemoClientProps {
  appId: string
  taskId: string
  configParam: string
}

export default function WidgetDemoClient({
  appId,
  taskId,
  configParam,
}: WidgetDemoClientProps) {
  // Use the config param directly from server (already in short key format)
  const widgetUrl = `/widget/app/${appId}/${taskId}${configParam}`

  return (
    <div className="min-h-screen bg-background">
          {/* AI Chat App Demo */}
          <div className="h-screen flex flex-col">
            {/* AI Chat App Header */}
            <div className="border-b bg-card px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-semibold text-sm">
                AI
              </div>
              <div className="flex-1">
                <h1 className="font-semibold text-sm">AI Assistant</h1>
                <p className="text-xs text-muted-foreground">Powered by TEE</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Secure</span>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Chat Messages - Left Side */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-gradient-to-b from-background to-muted/20">
                {/* User Message 1 */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                    <p className="text-sm">What's the weather like in San Francisco today?</p>
                  </div>
                </div>

                {/* AI Response 1 */}
                <div className="flex justify-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0 mt-1">
                    AI
                  </div>
                  <div className="max-w-[80%] bg-card border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <p className="text-sm text-foreground mb-2">The current weather in San Francisco is:</p>
                    <ul className="text-sm text-foreground space-y-1 mb-2">
                      <li>• Temperature: 62°F (17°C)</li>
                      <li>• Conditions: Partly cloudy</li>
                      <li>• Wind: 12 mph from the west</li>
                      <li>• Humidity: 65%</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">It's a pleasant day with some clouds. Perfect for outdoor activities!</p>
                  </div>
                </div>

                {/* User Message 2 */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                    <p className="text-sm">Can you help me write a professional email?</p>
                  </div>
                </div>

                {/* AI Response 2 */}
                <div className="flex justify-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0 mt-1">
                    AI
                  </div>
                  <div className="max-w-[80%] bg-card border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <p className="text-sm text-foreground mb-3">Of course! I'd be happy to help you write a professional email. To create the best email for your needs, could you provide me with:</p>
                    <ol className="text-sm text-foreground space-y-1.5 mb-3 list-decimal list-inside">
                      <li>The purpose of the email</li>
                      <li>Who you're sending it to</li>
                      <li>Key points you want to include</li>
                      <li>The tone you'd prefer (formal, semi-formal, friendly)</li>
                    </ol>
                    <p className="text-sm text-muted-foreground">Once you share these details, I'll draft a polished email for you!</p>
                  </div>
                </div>

                {/* User Message 3 */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                    <p className="text-sm">How does your TEE security work?</p>
                  </div>
                </div>

                {/* AI Response 3 */}
                <div className="flex justify-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0 mt-1">
                    AI
                  </div>
                  <div className="max-w-[80%] bg-card border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <p className="text-sm text-foreground mb-2">I run inside a Trusted Execution Environment (TEE), which provides hardware-level security:</p>
                    <ul className="text-sm text-foreground space-y-1.5 mb-3">
                      <li>🔒 <strong>Isolated Processing</strong>: Your data is processed in a secure enclave</li>
                      <li>✅ <strong>Verified Code</strong>: My source code is cryptographically verified</li>
                      <li>🛡️ <strong>End-to-End Encryption</strong>: All communications are encrypted</li>
                      <li>📜 <strong>Attestation Reports</strong>: You can verify my security claims</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">Check the Trust Certificate in the sidebar to see the full verification details! →</p>
                  </div>
                </div>
              </div>

              {/* Widget Sidebar - Right Side */}
              <div className="w-80 border-l bg-card/50 overflow-hidden">
                <iframe
                  src={widgetUrl}
                  className="w-full h-full border-0"
                  title="Trust Certificate Widget"
                />
              </div>
            </div>

            {/* Chat Input - Bottom */}
            <div className="border-t bg-card p-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    disabled
                  />
                </div>
                <button
                  className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                  disabled
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
  )
}
