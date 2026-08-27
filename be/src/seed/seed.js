import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Delivery from '../models/Delivery.js'
import ReworkEvent from '../models/ReworkEvent.js'
import Capture from '../models/Capture.js'
import Blocker from '../models/Blocker.js'

const DAY = 86_400_000
const ago = (d) => new Date(Date.now() - d * DAY)
const ahead = (d) => new Date(Date.now() + d * DAY)

await connectDb()
await Promise.all(
  [User, Project, Task, Delivery, ReworkEvent, Capture, Blocker].map((m) => m.deleteMany({}))
)

const [lead, asad, bilal, sara, hamza] = await User.create([
  { name: 'Sohaib', role: 'lead', title: 'Team Lead', aliases: ['sohaib', 'me'], avatarColor: '#f4a259' },
  { name: 'Asad', role: 'dev', title: 'Frontend', aliases: ['asad'], avatarColor: '#6b7cff' },
  { name: 'Bilal', role: 'dev', title: 'Backend', aliases: ['bilal'], avatarColor: '#4cc38a' },
  { name: 'Sara', role: 'dev', title: 'Design / Frontend', aliases: ['sara'], avatarColor: '#e5484d' },
  { name: 'Hamza', role: 'dev', title: 'Full stack', aliases: ['hamza'], avatarColor: '#c77dff', capacityPercent: 60 },
])

const [widespace, checkout, legacy] = await Project.create([
  {
    name: 'Widespaces', aliases: ['widespace', 'widespaces'], client: 'Northwind',
    mode: 'development', targetDate: ahead(9), health: 'amber', color: '#6b7cff',
    members: [
      { user: asad._id, allocation: 100, role: 'Lead dev' },
      { user: sara._id, allocation: 60, role: 'Design' },
    ],
  },
  {
    name: 'Checkout Revamp', aliases: ['checkout'], client: 'Loop',
    mode: 'development', targetDate: ahead(21), health: 'green', color: '#4cc38a',
    members: [{ user: bilal._id, allocation: 80, role: 'API' }],
  },
  {
    // the point of modes: Hamza looks busy on paper but is only 25% spent
    name: 'Orion Legacy', aliases: ['orion', 'legacy'], client: 'Orion Group',
    mode: 'support', health: 'green', color: '#8d93ad',
    members: [
      { user: hamza._id, allocation: 100, role: 'On call' },
      { user: sara._id, allocation: 40, role: 'Fixes' },
    ],
  },
])

await Task.create([
  // team track
  {
    project: widespace._id, assignee: asad._id, track: 'team', title: 'Fix widespace grid overflow',
    state: 'in_progress', startedAt: ago(3), assignedAt: ago(3), dueDate: ahead(2),
    reopenCount: 1, priority: 'high',
    history: [{ from: null, to: 'assigned', at: ago(3) }, { from: 'assigned', to: 'in_progress', at: ago(3) }],
  },
  {
    project: checkout._id, assignee: bilal._id, track: 'team', title: 'Checkout API contract',
    state: 'in_progress', startedAt: ago(1), assignedAt: ago(1), dueDate: ahead(6),
    history: [{ from: null, to: 'assigned', at: ago(1) }],
  },
  {
    project: widespace._id, assignee: sara._id, track: 'team', title: 'Landing copy pass',
    state: 'submitted', startedAt: ago(5), assignedAt: ago(6), dueDate: ago(1),
    history: [{ from: null, to: 'assigned', at: ago(6) }, { from: 'in_progress', to: 'submitted', at: ago(1) }],
  },
  {
    project: widespace._id, assignee: asad._id, track: 'team', title: 'Responsive nav breakpoints',
    state: 'submitted', startedAt: ago(4), assignedAt: ago(4),
    history: [{ from: null, to: 'assigned', at: ago(4) }, { from: 'in_progress', to: 'submitted', at: ago(1) }],
  },
  { project: legacy._id, assignee: hamza._id, track: 'team', title: 'Patch the export timeout', state: 'assigned', assignedAt: ago(1) },

  // on me
  { project: widespace._id, track: 'lead', title: 'Send Asad the staging API key', waitingOnLabel: 'for Asad', state: 'assigned', assignedAt: ago(1), dueDate: ahead(0) },
  { project: checkout._id, track: 'lead', title: 'Review Bilal’s API contract doc', waitingOnLabel: 'for Bilal', state: 'assigned', assignedAt: ago(2) },

  // client
  { project: checkout._id, track: 'client', title: 'Sign-off on payment scope', waitingOnLabel: 'Loop', state: 'assigned', assignedAt: ago(4) },
  { project: widespace._id, track: 'client', title: 'Final brand assets', waitingOnLabel: 'Northwind', state: 'assigned', assignedAt: ago(6), dueDate: ahead(1) },
])

const grid = await Task.findOne({ title: /grid overflow/ })
const copy = await Task.findOne({ title: /copy pass/ })

// the exact case he described: same task back twice, opposite meanings
await ReworkEvent.create([
  { task: grid._id, project: widespace._id, subject: asad._id, reason: 'not_fixed', attributedTo: 'dev', points: -2, note: 'grid still overflowed at 1440', occurredAt: ago(2) },
  { task: copy._id, project: widespace._id, subject: sara._id, reason: 'client_change', attributedTo: 'client', points: 0.5, note: 'Northwind rewrote the headline', occurredAt: ago(3) },
])

await Delivery.create([
  { task: copy._id, project: widespace._id, owner: sara._id, title: 'Landing copy v1', promisedDate: ago(6), actualDate: ago(6) },
  { project: checkout._id, owner: bilal._id, title: 'Cart state refactor', promisedDate: ago(9), actualDate: ago(10) },
  { project: widespace._id, owner: asad._id, title: 'Widespace grid v1', promisedDate: ago(8), actualDate: ago(5) },
  { project: legacy._id, owner: hamza._id, title: 'Export hotfix', promisedDate: ago(3), actualDate: ago(3) },
])

console.log('seeded: 5 people, 3 projects (1 support), 9 tasks across 3 tracks, 2 rework events, 4 deliveries')
await mongoose.disconnect()
