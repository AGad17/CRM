'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TASK_TYPES = {
  Call:     { label: 'Call',      emoji: '📞', color: 'bg-blue-100 text-blue-700'   },
  Email:    { label: 'Email',     emoji: '✉️',  color: 'bg-purple-100 text-purple-700' },
  Meeting:  { label: 'Meeting',   emoji: '📅', color: 'bg-amber-100 text-amber-700' },
  FollowUp: { label: 'Follow-up', emoji: '🔁', color: 'bg-teal-100 text-teal-700'   },
  Demo:     { label: 'Demo',      emoji: '🎯', color: 'bg-indigo-100 text-indigo-700' },
  Other:    { label: 'Other',     emoji: '📌', color: 'bg-gray-100 text-gray-600'   },
}

const EMPTY_FORM = {
  title: '', type: 'FollowUp', assignedToId: '', dueDate: '', notes: '',
  accountId: '', leadId: '', caseId: '',
}

function toDateStr(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isToday(d) {
  const t = new Date(d)
  const now = new Date()
  return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate()
}

function isOverdue(d) {
  const t = new Date(d)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return t < now && !isToday(d)
}

function isThisWeek(d) {
  const t = new Date(d)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  return t >= startOfWeek && t <= endOfWeek && !isToday(d) && !isOverdue(d)
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, currentUserId, isAdmin, onComplete, onCancel, onDelete, onEdit, highlight }) {
  const type     = TASK_TYPES[task.type] || TASK_TYPES.Other
  const overdue  = task.status === 'Open' && isOverdue(task.dueDate)
  const today    = task.status === 'Open' && isToday(task.dueDate)
  const done     = task.status === 'Done'
  const cancelled = task.status === 'Cancelled'
  const canAct   = isAdmin || task.assignedToId === currentUserId || task.createdById === currentUserId

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
      highlight ? 'ring-2 ring-indigo-400 border-indigo-200 bg-indigo-50' :
      done      ? 'bg-gray-50 border-gray-100 opacity-60' :
      cancelled ? 'bg-gray-50 border-gray-100 opacity-40' :
      overdue   ? 'bg-red-50 border-red-200' :
      today     ? 'bg-amber-50 border-amber-200' :
                  'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      {/* Complete checkbox */}
      <button
        onClick={() => canAct && !done && !cancelled && onComplete(task)}
        disabled={!canAct || done || cancelled}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          done      ? 'bg-green-500 border-green-500 text-white' :
          cancelled ? 'bg-gray-300 border-gray-300' :
          'border-gray-300 hover:border-green-400 cursor-pointer'
        } disabled:cursor-default`}
        title={done ? 'Completed' : 'Mark as done'}
      >
        {done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${type.color}`}>
            <span>{type.emoji}</span> {type.label}
          </span>
          <span className={`text-sm font-medium ${done || cancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : today ? 'text-amber-600 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>
            {done ? `✓ Done ${toDateStr(task.completedAt)}` :
             cancelled ? '✕ Cancelled' :
             overdue ? `⚠ Overdue · ${toDateStr(task.dueDate)}` :
             today   ? `Today · ${toDateStr(task.dueDate)}` :
             `Due ${toDateStr(task.dueDate)}`}
          </span>
          {task.assignedTo && (
            <span className="text-xs text-gray-400">
              → {task.assignedTo.name || task.assignedTo.email}
            </span>
          )}
          {task.account && (
            <a href={`/accounts/${task.accountId}`} className="text-xs text-indigo-500 hover:text-indigo-700 truncate max-w-[140px]">
              🏢 {task.account.name}
            </a>
          )}
          {task.lead && !task.account && (
            <span className="text-xs text-gray-400 truncate max-w-[140px]">
              🎯 {task.lead.companyName}
            </span>
          )}
          {task.case && (
            <a href={`/cases/${task.caseId}`} className="text-xs text-orange-500 hover:text-orange-700 truncate max-w-[140px]">
              🎫 {task.case.title}
            </a>
          )}
        </div>

        {task.notes && !done && (
          <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">{task.notes}</p>
        )}
        {done && task.completedNotes && (
          <p className="text-xs text-green-700 mt-1 italic">"{task.completedNotes}"</p>
        )}
      </div>

      {/* Actions */}
      {canAct && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {!done && !cancelled && (
            <button
              onClick={() => onEdit(task)}
              className="text-gray-300 hover:text-indigo-500 text-xs transition-colors p-1"
              title="Edit"
            >✏️</button>
          )}
          {!done && !cancelled && (
            <button
              onClick={() => { if (confirm('Cancel this task?')) onCancel(task) }}
              className="text-gray-300 hover:text-orange-500 text-xs transition-colors p-1"
              title="Cancel task"
            >✕</button>
          )}
          <button
            onClick={() => { if (confirm('Delete this task?')) onDelete(task.id) }}
            className="text-gray-300 hover:text-red-500 text-xs transition-colors p-1"
            title="Delete"
          >🗑</button>
        </div>
      )}
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function TaskGroup({ title, color, tasks, highlightId, ...cardProps }) {
  if (tasks.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${color}`}>{title}</span>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map(t => <TaskCard key={t.id} task={t} highlight={t.id === highlightId} {...cardProps} />)}
      </div>
    </div>
  )
}

// ─── Complete modal ───────────────────────────────────────────────────────────

function CompleteModal({ task, onConfirm, onClose }) {
  const [notes, setNotes] = useState('')
  if (!task) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Complete Task</h2>
        <p className="text-sm text-gray-600">Marking <span className="font-semibold">"{task.title}"</span> as done.</p>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Completion Notes <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What was the outcome?"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
          <button
            onClick={() => onConfirm(notes)}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Mark Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────

function TaskModal({ initial, users, currentUserId, isAdmin, onSave, onClose, isSaving }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        title:        initial.title,
        type:         initial.type,
        assignedToId: initial.assignedToId,
        dueDate:      initial.dueDate ? new Date(initial.dueDate).toISOString().split('T')[0] : '',
        notes:        initial.notes || '',
        accountId:    initial.accountId?.toString() || '',
        leadId:       initial.leadId?.toString()    || '',
        caseId:       initial.caseId?.toString()    || '',
      }
    }
    return { ...EMPTY_FORM, assignedToId: currentUserId || '', dueDate: new Date().toISOString().split('T')[0] }
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!initial

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Task' : 'New Task'}</h2>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title *</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="What needs to be done?"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Type + Due Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type *</label>
            <select
              value={form.type}
              onChange={e => set('type', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              {Object.entries(TASK_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Due Date *</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {/* Assign To */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assign To *</label>
          <select
            value={form.assignedToId}
            onChange={e => set('assignedToId', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">— Select person —</option>
            {(users || []).map(u => (
              <option key={u.id} value={u.id}>{u.name || u.email}{u.id === currentUserId ? ' (me)' : ''}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Optional context or details…"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        {/* Link to entity */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Link to Account ID <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            type="number"
            value={form.accountId}
            onChange={e => set('accountId', e.target.value)}
            placeholder="Account ID"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.title.trim() || !form.type || !form.assignedToId || !form.dueDate || isSaving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  const currentUserId = session?.user?.id
  const isAdmin       = session?.user?.role === 'CCO_ADMIN'

  const [filterUserId, setFilterUserId] = useState('')
  const [showDone,     setShowDone]     = useState(false)
  const [showModal,    setShowModal]    = useState(false)
  const [editTask,     setEditTask]     = useState(null)
  const [completeTask, setCompleteTask] = useState(null)
  const highlightId = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : null

  // Active assignee filter: admin can filter by user, others always see their own
  const activeUserId = isAdmin ? (filterUserId || null) : currentUserId

  // Build query string
  const qs = new URLSearchParams()
  if (activeUserId) qs.set('assignedToId', activeUserId)
  else if (isAdmin) qs.set('all', '1')
  qs.set('includeAll', 'true')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', activeUserId, isAdmin],
    queryFn:  () => fetch(`/api/tasks?${qs.toString()}`).then(r => r.json()),
    enabled:  !!currentUserId,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => fetch('/api/users').then(r => r.json()),
    enabled:  !!currentUserId,
  })

  // Mutations
  const createM = useMutation({
    mutationFn: (data) => fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setShowModal(false) },
  })

  const updateM = useMutation({
    mutationFn: ({ id, ...data }) => fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setEditTask(null); setCompleteTask(null) },
  })

  const deleteM = useMutation({
    mutationFn: (id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  // Handlers
  const handleSave = (form) => {
    if (editTask) {
      updateM.mutate({ id: editTask.id, ...form })
    } else {
      createM.mutate(form)
    }
  }

  const handleComplete = (completedNotes) => {
    updateM.mutate({ id: completeTask.id, status: 'Done', completedNotes })
  }

  const handleCancel = (task) => updateM.mutate({ id: task.id, status: 'Cancelled' })

  // Bucket tasks
  const openTasks      = tasks.filter(t => t.status === 'Open')
  const finishedTasks  = tasks.filter(t => t.status !== 'Open')

  const overdueTasks   = openTasks.filter(t => isOverdue(t.dueDate))
  const todayTasks     = openTasks.filter(t => isToday(t.dueDate))
  const thisWeekTasks  = openTasks.filter(t => isThisWeek(t.dueDate))
  const upcomingTasks  = openTasks.filter(t => !isOverdue(t.dueDate) && !isToday(t.dueDate) && !isThisWeek(t.dueDate))

  const cardProps = {
    currentUserId,
    isAdmin,
    onComplete: (task) => setCompleteTask(task),
    onCancel:   handleCancel,
    onDelete:   (id) => deleteM.mutate(id),
    onEdit:     (task) => setEditTask(task),
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <Breadcrumb items={[{ label: 'Tasks' }]} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isAdmin && !filterUserId ? `All team tasks` : `Tasks for ${users.find(u => u.id === (filterUserId || currentUserId))?.name || 'you'}`}
            {' · '}{openTasks.length} open
            {overdueTasks.length > 0 && <span className="text-red-500 font-semibold"> · {overdueTasks.length} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              value={filterUserId}
              onChange={e => setFilterUserId(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">All Team</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}{u.id === currentUserId ? ' (me)' : ''}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => { setEditTask(null); setShowModal(true) }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Task groups */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      ) : openTasks.length === 0 && finishedTasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-lg font-semibold text-gray-500">All clear!</p>
          <p className="text-sm mt-1">No tasks here. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <TaskGroup title="Overdue"    color="bg-red-100 text-red-700"    tasks={overdueTasks}  highlightId={highlightId} {...cardProps} />
          <TaskGroup title="Today"      color="bg-amber-100 text-amber-700" tasks={todayTasks}    highlightId={highlightId} {...cardProps} />
          <TaskGroup title="This Week"  color="bg-blue-100 text-blue-700"   tasks={thisWeekTasks} highlightId={highlightId} {...cardProps} />
          <TaskGroup title="Upcoming"   color="bg-gray-100 text-gray-600"   tasks={upcomingTasks} highlightId={highlightId} {...cardProps} />

          {/* Done / Cancelled toggle */}
          {finishedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowDone(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>{showDone ? '▼' : '▶'}</span>
                <span>{showDone ? 'Hide' : 'Show'} completed & cancelled ({finishedTasks.length})</span>
              </button>
              {showDone && (
                <div className="mt-3 space-y-2 opacity-70">
                  {finishedTasks.map(t => (
                    <TaskCard key={t.id} task={t} {...cardProps} highlight={t.id === highlightId} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(showModal || editTask) && (
        <TaskModal
          initial={editTask}
          users={users}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTask(null) }}
          isSaving={createM.isPending || updateM.isPending}
        />
      )}
      {completeTask && (
        <CompleteModal
          task={completeTask}
          onConfirm={handleComplete}
          onClose={() => setCompleteTask(null)}
        />
      )}
    </div>
  )
}
