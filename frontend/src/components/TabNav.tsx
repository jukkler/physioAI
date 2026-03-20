type Tab = 'recording' | 'chat' | 'archive'

interface TabNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'recording', label: 'Aufnahme' },
  { key: 'chat', label: 'Assistent' },
  { key: 'archive', label: 'Verlauf' },
]

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="flex border-b bg-white">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.key
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export type { Tab }
