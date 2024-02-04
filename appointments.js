import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { StringObject } from '../types'
import type { User, UserType,UserTypeLowerCase } from '../types/user'
import type {
  Appointment,
  AppointmentLog,
  Appointment_to_patient,
  GlobalAppointment,
  GlobalAppointmentReference,
} from '../types/appointment'
import moment from 'moment'
import { isConnected, allow, getName } from '../lib/common'
import Schemas from '../schemas/appointments'
import { Task } from '../types/task'
import { decodeUnixTimestamp, decodeDateTime } from '../lib/epoch_timestamps'

function sendNotificationEmail(
  req: FastifyRequest,
  patient: User,
  appointment: Appointment,
  meeting: { join_url: string } | null
){
  try {
    // Send join url email to patient email
    req.bnd.send.email({
      sender: 'General-Email-Sender',
      express: true,
      priority: 'high',
      template: `${appointment.type}-appointment`,
      subject: `Upswing ${appointment.type.replace('_', ' ')} appointment`,
      recipient: {
        name: getName(patient.profile),
        address: patient.profile.email,
      },
      scope: {
        PATIENT_FIRST_NAME: patient.profile.first_name,
        CLINICIAN_NAME: appointment.clinician.name,
        START_DATETIME: `${appointment.schedule.start.date} ${appointment.schedule.start.time}`,
        // Tenant: !isTenant( req ) ? process.env.APPNAME : req.tenant.name,
        JOIN_URL: meeting?.join_url,
      },
    })
  } catch (error) {
    console.log('Failed sending meeting notification via email: ', error)
  }
}

async function updateAvailableSlots(
  req: FastifyRequest,
  state: string,
  provider_type: string
){
  /*
   *      This is to update the slots of global slots based on the avbl provider slots
   *      for the given state
   *
   */
  const state_slots = await dtarget(req, '#cal').findOne({
    type: 'global',
    state: state,
  })
  if (state_slots) {
    const {slots} = state_slots[`${provider_type}`]
    for (const time_slot in slots) {
      // Queries to check weather provider is licenced at given state
      const queryField = `${provider_type}.slots.${time_slot}`
      const Clinician = await dtarget(req, '#users').find({
        [queryField]: true,
        'account.types': { $in: [provider_type.toUpperCase()] },
        'profile.super.licence_at': { $in: [state.toUpperCase()] },
      })

      slots[time_slot] = Clinician.length > 0
      // Await dtarget(req, "#cal").updateOne({ 'type': 'global' ,'state':state},{ $set: { [`${provider_type}.slots.${time_slot}`]: slots[time_slot] } });
    }
    await dtarget(req, '#cal').updateOne(
      { type: 'global', state: state },
      { $set: { [`${provider_type}.slots`]: slots } }
    )
    return slots
  }
  return {}
}

function findNearestAvailableSlots(
  timeSlots: { [key: number]: boolean },
  currentTimestamp: number
){
  const inputMoment = moment.unix(currentTimestamp)
  let nextTimestamp = null
  for (const timestamp in timeSlots) {
    const isValid = timeSlots[timestamp]
    if (isValid) {
      const diffMinutes = moment
        .unix(Number(timestamp))
        .diff(inputMoment, 'minutes')
      if (diffMinutes >= 10) {
        nextTimestamp = timestamp
        break
      }
    }
  }
  return Number(nextTimestamp)
}

const groupSlotsByDate = (slots: { [key: number]: boolean }) => {
  const groupedSlots: any = {}
  Object.keys(slots).forEach((timestamp: any) => {
    const date = moment.unix(timestamp).utc().format('YYYY-MM-DD')
    if (!groupedSlots[date]) {
      groupedSlots[date] = {}
    }
    groupedSlots[date][timestamp] = slots[timestamp]
  })
  return groupedSlots
}

export default async (App: FastifyInstance) => {
  const AllowedUserTypes = process.env.POSSIBLE_USER_TYPES?.split(
    ','
  ) as UserType[]

  App.addHook('preHandler', isConnected)
    .addHook('preHandler', allow(AllowedUserTypes))

    .post(
      '/find_available_slots',
      Schemas.find_avbl_slots,
      async (req, rep) => {
        /*
         * The global calender does keep on updating the slots based on provider availabilty for every API hit
         * basically this api is to show when schedule for later is opted
         */
        const { state, provider_type }: any = req.body
        const slots = await updateAvailableSlots(req, state, provider_type)

        return rep.code(200).send({
          error: false,
          status: 'SLOTS:AVAILABLE',
          slots: groupSlotsByDate(slots),
        })
      }
    )

    .post('/find_provider', Schemas.find_provider, async (req, rep) => {
      const { time_stamp, provider_type, schedule_type, state }: any = req.body,
        provider_profile: any = {}
      let time_slot = time_stamp
      // Get the available state global slots to check available time
      const state_global_slots: { [key: number]: boolean } =
        await updateAvailableSlots(req, state, provider_type)
      if (schedule_type === 'now') {
        const time_slot_to_look = findNearestAvailableSlots(
          state_global_slots,
          time_stamp
        )
        console.log(
          clc.yellow(String(time_slot_to_look)),
          '==>',
          clc.green(decodeUnixTimestamp(time_slot_to_look))
        )
        time_slot = time_slot_to_look
      }
      console.log(
        clc.blue(
          `Adjusted time slot for given slot ${decodeUnixTimestamp(
            time_stamp
          )} to ${decodeUnixTimestamp(time_slot)}`
        )
      )
      const queryField = `${provider_type}.slots.${time_slot}`
      // To find providers in licenced state
      const providers = await dtarget(req, '#users').find({
          [queryField]: true,
          'account.types': { $in: [provider_type.toUpperCase()] },
          'profile.super.licence_at': { $in: [state.toUpperCase()] },
        }),
        randomIndex = Math.floor(Math.random() * providers.length),
        provider = providers[randomIndex]
      if (provider) {
        provider_profile.email = provider.profile.email
        provider_profile.name = provider.profile.first_name
        provider_profile.bio = provider.profile.super.bio || ''
        provider_profile.available_time = time_slot
        provider_profile.type = provider_type
        return rep.code(200).send({
          error: false,
          status: 'PROVIDER:FOUND',
          profile: provider_profile,
        })
      }
      return rep.code(400).send({
        error: true,
        status: 'PROVIDER:NOT FOUND',
        message: `No ${provider_type} available at the moment`,
      })
    })

    .post(
      '/schedule_appointment',
      Schemas.schedule_appointment,
      async (req, rep) => {
        // NOTE The time slot is always available coz this will be called based on response by find_provider
        const {
            time_slot,
            provider_type,
            appointment_type,
            provider_id,
            condition_reference_id,
          }: any = req.body,
          existing_appointment_condition = {
            'clinician.type': provider_type,
            patient: req.uid,
            status: { $in: ['APPROVED'] },
          },
          exists: Appointment = await dtarget(req, 'appointments').findOne(
            existing_appointment_condition
          )

        console.log(req.uid, req.usertype)

        if (exists) {
          return rep.code(400).send({
            error: true,
            status: 'APPOINTMENT::FAILED',
            message: `You have an appointment ${exists.status.toLowerCase()} with ${provider_type}`,
            reference: exists.reference,
          })
        }
        const clinician = await dtarget(req, '#users').findOne({
          'profile.email': provider_id,
          [`${provider_type}.slots.${time_slot}`]: true,
        })
        if (!clinician) {
          return rep.code(404).send({
            error: true,
            status: 'CLINICIAN::NOT FOUND',
            message: 'INVALID TIME SLOT',
          })
        }
        const appointment: Appointment = {
          condition_reference_id: condition_reference_id || '',
          reference: ruuid(),
          type: appointment_type,
          clinician: {
            type: provider_type,
            id: clinician.profile.email,
            name: clinician.profile.first_name,
          },
          patient: req.uid,
          schedule: {
            start: decodeDateTime(time_slot),
            timeslot: time_slot,
          },
          status: 'APPROVED',
          logs: [],
          created: {
            at: Date.now(),
            by: req.uid,
          },
        }

        const user_origin = req.headers.origin || ''

        const global_appointmnet: GlobalAppointmentReference = {
          ...appointment,
          patient_id: req.uid,
          patient_origin: getOrigin(user_origin),
          provider_id: appointment.clinician.id,
          provider_type: appointment.clinician.type,
          datetime: Date.now(),
        }
        /*
         * Add the appointment to tenant level and also provider also
         * This will be used to get the stats of provider appointmetns on global
         */
        const inserted = await dtarget(req, 'appointments').insert(appointment)
        await dtarget(req, '#provider_appointments').insert(global_appointmnet)

        if (!inserted) {
          return rep.code(500).send({
            error: true,
            status: 'APPOINTMENT::FAILED',
            message: 'Unexpected error occured',
          })
        }
        // To change the clinician profile available -> not avbl once the appointment is scheduled and confirmed
        const condition = { 'profile.email': clinician.profile.email },
          toset = { $set: { [`${provider_type}.slots.${time_slot}`]: false } }
        await dtarget(req, '#users').updateOne(condition, toset)
        return rep.code(200).send({
          error: false,
          status: 'APPOINTMENT::SUCCESS',
          message: 'Your appointment scheduled successfully',
          reference: appointment.reference,
        })
      }
    )

    .post(
      '/appointment_to_patient',
      Schemas.appointment_to_patient,
      async (req, rep) => {
        try {
          const {
            time_slot,
            appointment_type,
            patient_id,
            condition_reference_id,
          }: any = req.body

          const existing_appointment_condition = {
            patient: patient_id,
            status: { $in: ['APPROVED'] },
          }

          const exists = await dtarget(req, 'appointments').findOne(existing_appointment_condition)

          if (exists) {
            return rep.code(400).send({
              error: true,
              status: 'APPOINTMENT::FAILED',
              message: `You have an appointment ${exists.status.toLowerCase()} with ${patient_id}`,
              reference: exists.reference,
            })
          }

          const user = await dtarget(req, 'users').findOne({
            'profile.email': patient_id,
          })

          if (!user) {
            return rep.code(404).send({
              error: true,
              status: 'PATIENT::NOT FOUND',
              message: 'Invalid patient ID',
            })
          }

          const appointment = {
            condition_reference_id: condition_reference_id || '',
            reference: ruuid(),
            type: appointment_type,
            clinician: {
              type: 'coach',
              id: req.uid,
              name: '',
            },
            patient: patient_id,
            schedule: {
              start: decodeDateTime(time_slot),
              timeslot: time_slot,
            },
            status: 'APPROVED',
            logs: [],
            created: {
              at: Date.now(),
              by: req.uid,
            },
          }

          const global_appointment = {
            ...appointment,
            patient_id: patient_id,
            provider_id: req.uid,
            provider_type: req.usertype,
            datetime: Date.now(),
          }

          const insertedAppointment = await dtarget(req, 'appointments').insert(appointment)
          const insertedGlobalAppointment = await dtarget(req, '#provider_appointments').insert(global_appointment)

          if (!insertedAppointment || !insertedGlobalAppointment) {
            return rep.code(500).send({
              error: true,
              status: 'APPOINTMENT::FAILED',
              message: 'Unexpected error occurred',
            })
          }

          // Additional actions after successful appointment creation can be added here

          return rep.code(200).send({
            error: false,
            status: 'APPOINTMENT::SUCCESS',
            message: 'Appointment with patient scheduled successfully',
            reference: appointment.reference,
          })
        } catch (error) {
          console.error('Error occurred:', error)
          return rep.code(500).send({
            error: true,
            status: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
          })
        }
      }
    )


    .get('/list/:uid?', async (req, rep) => {
      let appointments_list
      if (req.usertype === 'PATIENT') {
        console.log('Patient')

        appointments_list = await dtarget(req, 'appointments').find(
          {
            patient: req.uid,
          },
          {
            excludes: ['_id', 'notes'],
          }
        )
      } else {
        console.log('Coach')
        const { uid }: any = req.params as StringObject
        if (typeof uid !== 'undefined') {
          const condition = {
            patient: uid,
            status: { $ne: 'CANCELLED' },
          }
          appointments_list = await dtarget(req, 'appointments').find(
            condition,
            { excludes: ['_id'] }
          )
          console.log(condition)

          console.log(appointments_list)
        }
      }

      if (appointments_list) {
        return rep.code(200).send({
          error: false,
          status: 'APPOINTMENTS: LIST SUCCESSFULLY FETCHED',
          appointments_list: appointments_list,
        })
      }
      return rep.code(404).send({
        error: false,
        status: 'APPOINTMENTS: NO APPOINTMENTS FOUND',
        appointments_list: [],
      })
    })

    .delete('/cancel', Schemas.delete_appointment, async (req, rep) => {
      const { reference_id, cancel_reason }: any = req.body,
        condition = {
          reference: reference_id,
          status: 'APPROVED',
          patient: req.uid,
        },
        appointement: Appointment = await dtarget(req, 'appointments').findOne(
          condition
        )
      if (appointement) {
        const scheduled_appointment: Appointment = await dtarget(
          req,
          'appointments'
        ).updateOne(
          condition,
          { $set: { status: 'CANCELLED', comment: cancel_reason } },
          { returnUpdate: true }
        )

        await dtarget(req, '#provider_appointments').updateOne(condition, {
          $set: { status: 'CANCELLED', comment: cancel_reason },
        })

        console.log(scheduled_appointment)

        // Free the provider slot after cancellation
        const provider_type = scheduled_appointment.clinician.type
        const time_slot = scheduled_appointment.schedule.timeslot
        const queryField = `${provider_type}.slots.${time_slot}`
        await dtarget(req, '#users').updateOne(
          { 'profile.email': scheduled_appointment.clinician.id },
          { $set: { [queryField]: true } }
        )
        return rep.code(200).send({
          error: false,
          status: 'APPOINTMENTS: DELETED',
          message: 'appointment successfully deleted',
        })
      }
      return rep.code(404).send({
        error: false,
        status: 'APPOINTMENTS: APPOINTMENT NOT FOUND',
        message: 'no appointment found',
      })
    })

    /* Previous apis*/

    // Schedule a new appointment
    .post('/schedule', Schemas.schedule, async (req, rep) => {
      const { clinician } = req.body as Appointment,
        Clinician: User = await dtarget(req, '#users').findOne({
          'profile.email': clinician.id,
          [clinician.type]: { $exists: true },
        })
      if (!Clinician)
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::FAILED',
          message: 'Clinician Not Found',
        })

      const { patient } = req.body as Appointment,
        /**
         * Check whether there's an unresolved appointment
         * related to these two identical parties
         * - Clinician
         * - Patient
         */
        condition = {
          'clinician.id': clinician.id,
          patient: patient || req.uid,
          status: { $in: ['PENDING'] },
        },
        exists: Appointment = await dtarget(req, 'appointments').findOne(
          condition
        )
      if (exists)
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::FAILED',
          message: `You have an appointment ${exists.status.toLowerCase()} by this ${
            clinician.type
          }`,
          reference: exists.reference,
        })

      const { type, schedule, comment } = req.body as Appointment,
        status =
          clinician.id === req.uid || // Schedule by clinician
          Clinician[clinician.type]?.settings?.appointment?.autoApprove // Clinician set auto-approve his appointments
            ? 'APPROVED'
            : 'PENDING'

      // Default appointment mininum duration to 30 mins if not set
      if (!schedule.end || !schedule.end.date || !schedule.end.time)
        schedule.end = {
          date: schedule.start.date,
          time: moment(
            `${schedule.start.date} ${schedule.start.time}`,
            'YYYY-MM-DD hh:mm a'
          )
            .add(30, 'm')
            .format('hh:mm a'),
          // The actual incompleted end datetime set
          ...schedule.end,
        }

      const appointment: Appointment = {
          reference: ruuid(),
          type,
          clinician,
          patient: patient || req.uid,
          schedule,
          comment,
          status,
          logs: [],
          created: {
            at: Date.now(),
            by: req.uid,
          },
        },
        inserted = await dtarget(req, 'appointments').insert(appointment)
      if (!inserted)
        return rep.code(500).send({
          error: true,
          status: 'APPOINTMENT::FAILED',
          message: 'Unexpected error occured',
        })

      // Create task for pending appointment
      if (appointment.status === 'PENDING') {
        const { reference } = appointment,
          subject = 'Approve pending appointment',
          taskExists: Task = await dtarget(req, 'tasks').findOne({
            subject,
            'matter.type': 'appointement',
            'matter.action': 'approve',
            'matter.reference': reference,
            'clinician.id': clinician.id,
            patient: patient || req.uid,
          })

        if (!taskExists) {
          const task: Task = {
            reference: appointment.reference,
            subject,
            matter: {
              type: 'appointment',
              action: 'approve',
              reference,
            },
            clinician,
            patient: patient || req.uid,
            schedule,
            // Description,
            status: 'PENDING',
            logs: [],
            created: {
              at: Date.now(),
              by: 'auto',
            },
          }

          await dtarget(req, 'tasks').insert(task)
        }
      }

      // Send notification when appointment is auto approved
      if (appointment.status == 'APPROVED') {
        let patient = req.user // When reschedule is initiated by patient

        if (req.usertype.toLowerCase() !== 'patient') {
          patient = await dtarget(req, 'users').findOne({
            'profile.email': appointment.patient,
          })
          if (!patient)
            return rep.code(400).send({
              error: true,
              status: 'APPOINTMENT::PATIENT_NOT_FOUND',
              message: 'Patient Not Found',
            })
        }

        // Genereate appointment join link
        const meeting = {
          join_url: `//${toOrigin(
            getOrigin(req)
          )}/messages/${appointment.type.replace('_', '-')}/${
            appointment.reference
          }`,
        }

        sendNotificationEmail(req, patient, appointment, meeting)
      }

      rep.code(201).send({
        error: false,
        status: 'APPOINTMENT::SUCCESS',
        message: 'Appointment scheduled',
        reference: appointment.reference,
      })
    })

    // Fetch appointment list
    .get('/', Schemas.list, async (req) => {
      const { type, status, offset, timerange, date } =
        req.query as StringObject
      let { limit } = req.query as { limit: number }
      limit = limit || 20

      const operators: any = { limit, desc: true, excludes: ['_id'] },
        condition: any = {},
        usertype = req.usertype.toLowerCase()

      usertype === 'patient'
        ? (condition.patient = req.uid) // Fetch for patient
        : (condition['clinician.id'] = req.uid) // Fetch for clinician

      if (type) condition.type = type.toUpperCase()
      if (status) condition.status = status.toUpperCase()

      // Timestamp of the last item of previous results
      if (offset) operators.since = offset

      // Fetch data by time range: `today`, `week`, `month`
      switch (timerange) {
        case 'today':
          condition['schedule.start.date'] = moment().format('YYYY-MM-DD')
          break
        case 'week':
          condition['schedule.start.date'] = {
            $gte: moment().day(0).format(),
            $lte: moment().day(7).format(),
          }
          break
        case 'month':
          condition['schedule.start.date'] = {
            $gte: moment().date(0).format(),
            $lte: moment().add(1, 'months').format(),
          }
          break
      }

      // Filter by date
      if (date)
        condition['schedule.start.date'] = moment(date).format('YYYY-MM-DD')

      // Fetch only item no assign to any tag
      const results: Appointment[] = await dtarget(req, 'appointments').find(
        condition,
        operators
      )

      usertype !== 'patient' &&
        (await Promise.all(
          results.map(async (each, index) => {
            const user = (await dtarget(req, 'users').findOne(
              { 'profile.email': each.patient },
              { select: ['profile', 'account'] }
            )) as User
            if (!user) return

            results[index].patient = {
              ...user.profile,
              medicalHistory: user.account.settings.medicalHistory,
            } as any
          })
        ))

      // Return URL to be call to get more results
      let more
      if (results.length == limit)
        more = `/?offset=${results[limit - 1].created.at}&limit=${limit}${
          type ? `&type=${type}` : ''
        }${status ? `&status=${status}` : ''}`

      return { error: false, status: 'APPOINTMENT::FETCHED', results, more }
    })

    // Search appointment
    .get('/search', Schemas.search, async (req) => {
      const { query, filters } = req.query as StringObject,
        matcher = { $regex: String(query).replace(/\s+/g, '|'), $options: 'i' },
        condition: any = { $or: [] }

      // Appointment's information
      condition.$or.push({ type: matcher })
      condition.$or.push({ status: matcher })
      condition.$or.push({ comment: matcher })
      condition.$or.push({ patient: matcher })
      condition.$or.push({ 'clinician.id': matcher })
      condition.$or.push({ 'clinician.type': matcher })

      if (filters && filters != 'undefined') {
        condition['$and'] = []

        try {
          // Filter appointments by type
          const { from, to } = JSON.parse(filters)
        } catch (error) {
          console.log('Invalid Filter Set: ', error)
        }
      }

      return {
        error: false,
        status: 'APPOINTMENT::SEARCH',
        results: await dtarget(req, 'appointments').find(condition, {
          excludes: ['_id'],
        }),
      }
    })

    // Reschedule an appointment
    .patch('/:reference/reschedule', Schemas.reschedule, async (req, rep) => {
      const { reference }: any = req.params
      let appointment: Appointment = await dtarget(req, 'appointments').findOne(
        { reference }
      )
      if (!appointment)
        return rep.code(404).send({
          error: true,
          status: 'APPOINTMENT::NOT_FOUND',
          message: 'Appointment Not Found',
        })

      const { status, clinician } = appointment
      if (['ACTIVE', 'COMPLETED'].includes(status))
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::FAILED',
          message: 'Cannot reschedule this appointment',
        })

      const { type, start, end }: any = req.body,
        toSet: any = {
          status:
            clinician.id === req.uid || // Reschedule by clinician
            // Clinician set auto-approve his appointments
            (['PHYSICIAN', 'COACH'].includes(req.usertype) &&
              req.user[req.usertype.toLowerCase() as UserTypeLowerCase]
                ?.settings?.appointment?.autoApprove)
              ? 'APPROVED'
              : 'PENDING',
        }

      if (type) toSet.type = type
      if (start) {
        toSet['schedule.start'] = start
        toSet['schedule.end.time'] = moment(
          `${start.date} ${start.time}`,
          'YYYY-MM-DD hh:mm a'
        )
          .add(30, 'm')
          .format('hh:mm a')
      }
      if (end) toSet['schedule.end'] = end

      if (isEmpty(toSet))
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::INVALID_REQUEST',
          message: 'Invalid Request Arguments',
        })

      const toPush = {
        logs: {
          status: toSet.status,
          at: Date.now(),
          by: req.uid,
        } as AppointmentLog,
      }

      appointment = await dtarget(req, 'appointments').updateOne(
        { reference },
        { $set: toSet, $push: toPush },
        { returnUpdate: true }
      )

      const toUpdate: any = {}

      if (start) toUpdate['schedule.start'] = start
      if (end) toUpdate['schedule.end'] = end

      // Update related event
      await dtarget(req, 'events').updateOne({ reference }, { $set: toUpdate })

      // Send notification when appointment is auto approved
      if (appointment.status == 'APPROVED') {
        let patient = req.user // When reschedule is initiated by patient

        if (req.usertype.toLowerCase() !== 'patient') {
          patient = await dtarget(req, 'users').findOne({
            'profile.email': appointment.patient,
          })
          if (!patient)
            return rep.code(400).send({
              error: true,
              status: 'APPOINTMENT::PATIENT_NOT_FOUND',
              message: 'Patient Not Found',
            })
        }

        // Genereate appointment join link
        const meeting = {
          join_url: `//${toOrigin(
            getOrigin(req)
          )}/messages/${appointment.type.replace('_', '-')}/${
            appointment.reference
          }`,
        }

        sendNotificationEmail(req, patient, appointment, meeting)
      }

      return {
        error: false,
        status: 'APPOINTMENT::RESCHEDULED',
        appointment,
      }
    })

    // Change an appointment stage status
    .patch('/:reference', Schemas.changeStatus, async (req, rep) => {
      const { reference }: any = req.params
      const appointment: Appointment = await dtarget(req, 'appointments').findOne(
        { reference }
      )
      if (!appointment)
        return rep.code(404).send({
          error: true,
          status: 'APPOINTMENT::NOT_FOUND',
          message: 'Appointment Not Found',
        })

      const patient = await dtarget(req, 'users').findOne({
        'profile.email': appointment.patient,
      })
      if (!patient)
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::PATIENT_NOT_FOUND',
          message: 'Patient Not Found',
        })

      if (['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(appointment.status))
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::FAILED',
          message: `This appointment is ${appointment.status.toLowerCase()}`,
        })

      const { status } = req.body as StringObject
      if (
        !['APPROVED', 'ACTIVE', 'CANCELLED', 'COMPLETED'].includes(
          status.toUpperCase()
        ) || // Changeable status
        appointment.status == status.toUpperCase()
      )
        // Must be different from current status
        return rep.code(400).send({
          error: true,
          status: 'APPOINTMENT::FAILED',
          message: 'Invalid appointment status',
        })

      const toPush = {
        logs: {
          status,
          at: Date.now(),
          by: req.uid,
        } as AppointmentLog,
      }

      let meeting = null
      if (status == 'APPROVED') {
        await dtarget(req, 'tasks').updateOne(
          { reference, 'matter.action': 'approve' },
          { $set: { status: 'COMPLETED' } }
        )

        // Genereate appointment join link
        meeting = {
          join_url: `//${toOrigin(
            getOrigin(req)
          )}/messages/${appointment.type.replace('_', '-')}/${
            appointment.reference
          }`,
        }

        // Send approved appointment notification
        sendNotificationEmail(req, patient, appointment, meeting)
      }

      // Delete appointment event
      if (status == 'COMPLETED') {
        await dtarget(req, 'events').deleteOne({ id: reference })
        await dtarget(req, 'tasks').updateOne(
          { reference },
          { $set: { status } }
        )

        // Send completed appointment email notification
        try {
          req.bnd.send.email({
            sender: 'General-Email-Sender',
            express: true,
            priority: 'high',
            template: 'appointment-completed',
            subject: 'Upswing appointment completed',
            recipient: {
              name: getName(patient.profile),
              address: patient.profile.email,
            },
            scope: {
              PATIENT_FIRST_NAME: patient.profile.first_name,
              SUMMARY_LINK: '',
            },
          })
        } catch (error) {
          console.log(
            'Failed sending completed meeting notification via email: ',
            error
          )
        }
      }

      // Save updates
      await dtarget(req, 'appointments').updateOne(
        { reference },
        { $set: { status, meeting }, $push: toPush }
      )
      return {
        error: false,
        status: 'APPOINTMENT::UPDATED',
        message: `Appointment ${status.toLowerCase()}`,
      }
    })

    // Retreive appointment
    .get('/:reference', Schemas.retreive, async (req, rep) => {
      const { reference } = req.params as StringObject,
        appointment = (await dtarget(req, 'appointments').findOne({
          reference,
        })) as Appointment
      if (!appointment)
        return rep.code(404).send({
          error: true,
          status: 'APPOINTMENT::NOT_FOUND',
          message: 'Appointment Not Found',
        })

      return {
        error: false,
        status: 'APPOINTMENT::RETREIVED',
        message: 'Appointment retreived',
        appointment,
      }
    })
}
