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
import StandupSession from '../models/StandupSession.js'
import Note from '../models/Note.js'

/**
 * Wipes everything and leaves exactly one record: the lead.
 *
 * There is no sample data on purpose. Fake devs and fake projects make an app
 * feel already-used, and the first real thing you type ends up sitting next to
 * someone called Asad who does not exist.
 */
await connectDb()

const models = [Project, Task, Delivery, ReworkEvent, Capture, Blocker, StandupSession, Note]
await Promise.all(models.map((m) => m.deleteMany({})))
await User.deleteMany({})

const name = process.argv[2] || 'Me'
await User.create({ name, role: 'lead', title: 'Team Lead', aliases: [name.toLowerCase(), 'me', 'i'] })

console.log(`reset. one lead account ("${name}"), nothing else.`)
console.log('add your team from the Team page, then create projects.')
await mongoose.disconnect()
