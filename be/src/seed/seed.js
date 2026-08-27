import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import User from '../models/User.js'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Blocker from '../models/Blocker.js'
import Delivery from '../models/Delivery.js'
import ReworkEvent from '../models/ReworkEvent.js'

const DAY = 86_400_000
const ago = (d) => new Date(Date.now() - d * DAY)
const ahead = (d) => new Date(Date.now() + d * DAY)

await connectDb()
await Promise.all(
  [User, Project, Task, Blocker, Delivery, ReworkEvent].map((m) => m.deleteMany({}))
)

const [lead, asad, bilal, sara] = await User.create([
  { name: 'Sohaib', role: 'lead', aliases: ['sohaib', 'me'], avatarColor: '#f4a259' },
  { name: 'Asad', role: 'dev', aliases: ['asad'], avatarColor: '#6b7cff' },
  { name: 'Bilal', role: 'dev', aliases: ['bilal'], avatarColor: '#4cc38a' },
  { name: 'Sara', role: 'dev', aliases: ['sara'], avatarColor: '#e5484d' },
])

const [widespace, checkout] = await Project.create([
  { name: 'Widespaces', aliases: ['widespace', 'widespaces'], client: 'Northwind', targetDate: ahead(9), health: 'amber' },
  { name: 'Checkout Revamp', aliases: ['checkout'], client: 'Loop', targetDate: ahead(21), health: 'green' },
])

const [gridFix, apiWork, copyPass] = await Task.create([
  {
    project: widespace._id, assignee: asad._id, title: 'Fix widespace grid overflow',
    state: 'in_progress', startedAt: ago(3), assignedAt: ago(3), dueDate: ahead(2),
    reopenCount: 1, priority: 'high',
    history: [{ from: null, to: 'assigned', at: ago(3) }, { from: 'assigned', to: 'in_progress', at: ago(3) }],
  },
  {
    project: checkout._id, assignee: bilal._id, title: 'Checkout API contract',
    state: 'in_progress', startedAt: ago(1), assignedAt: ago(1), dueDate: ahead(6),
    history: [{ from: null, to: 'assigned', at: ago(1) }],
  },
  {
    project: widespace._id, assignee: sara._id, title: 'Landing copy pass',
    state: 'submitted', startedAt: ago(5), assignedAt: ago(6), dueDate: ago(1),
    history: [{ from: null, to: 'assigned', at: ago(6) }],
  },
])

await Blocker.create([
  { task: gridFix._id, project: widespace._id, type: 'waiting_on_dev', waitingOn: sara._id, item: 'final figma for the grid', raisedBy: lead._id, openedAt: ago(2) },
  { project: widespace._id, type: 'waiting_on_me', waitingOn: lead._id, waitingOnLabel: 'for Asad', item: 'staging API key', raisedBy: lead._id, openedAt: ago(1) },
  { project: checkout._id, type: 'waiting_on_client', waitingOnLabel: 'Loop', item: 'sign-off on payment scope', raisedBy: lead._id, openedAt: ago(4) },
])

// the case he described: same fix handed back twice, but for two different reasons
await ReworkEvent.create([
  { task: gridFix._id, project: widespace._id, subject: asad._id, reason: 'not_fixed', attributedTo: 'dev', points: -2, note: 'grid still overflowed at 1440', occurredAt: ago(2) },
  { task: copyPass._id, project: widespace._id, subject: sara._id, reason: 'client_change', attributedTo: 'client', points: 0.5, note: 'Northwind rewrote the headline', occurredAt: ago(3) },
])

await Delivery.create([
  { task: copyPass._id, project: widespace._id, owner: sara._id, title: 'Landing copy v1', promisedDate: ago(6), actualDate: ago(6) },
  { project: checkout._id, owner: bilal._id, title: 'Cart state refactor', promisedDate: ago(9), actualDate: ago(10) },
  { project: widespace._id, owner: asad._id, title: 'Widespace grid v1', promisedDate: ago(8), actualDate: ago(5) },
])

console.log('seeded: 4 people, 2 projects, 3 tasks, 3 blockers, 2 rework events, 3 deliveries')
await mongoose.disconnect()
