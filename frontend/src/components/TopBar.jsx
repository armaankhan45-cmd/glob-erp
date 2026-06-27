import { useAuth } from '../context/AuthContext'

export default function TopBar() {
  const { user } = useAuth()
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-gray-800">
        {user?.organization?.name || 'Glob ERP'}
      </h2>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user?.name}</span>
        <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
      </div>
    </header>
  )
}
