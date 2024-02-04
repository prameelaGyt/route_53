.post("/getCounts", Schemas.counts, async (req, res) => {
    const { MongoClient } = require('mongodb');
    const mongoURI: string = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017';
    const client = new MongoClient(mongoURI, { useUnifiedTopology: true });
    try {
      
      await client.connect();
      const dbName: string = process.env.MAIN_DATABASE_NAME || '';
      const mainDb = client.db(dbName);
      const piloteCollection = mainDb.collection('--pilote--');
      const documents= await piloteCollection.find({}).toArray();
      const { start_date, end_date }:any = req.body;
      const startDate = new Date(parseInt(start_date));
      const endDate = new Date(parseInt(end_date));
      //let newAccountsCount = 0;
      let initialCoachVisits = 0;
      let followUpCoachVisits = 0;
      let initialPhysicianVisits = 0;
      let followUpPhysicianVisits = 0;
      let totalPainLevel = 0;  
      let numberOfDocsConsidered = 0;
      let TotalSpineProgramScreens=0;
      let acuteCount = 0;
      let chronicCount = 0;
      let rehab_program = 0;
      let physician_visit=0;
      let urgent_room=0;
      let no_followup= 0;
      let inperson_referral=0;
      let advice=0;
      let refer_navigator=0;
        
  
      for (const doc of documents) {
        const dbName = `uh_${doc.database}`;
        const targetDb = client.db(dbName);
        const usersCollection = targetDb.collection('users');
        const soapCollection = targetDb.collection('soap');
        const appointmentsCollection = targetDb.collection('appointments'); 
        const spineHealthResultsCollection = targetDb.collection('spine_health_results');
        
        // const usersCount = await usersCollection.countDocuments({
        //   datetime: {$gte: startDate.getTime(), $lte: endDate.getTime()}
        // });
        //newAccountsCount += usersCount;
        const spineHealthResultsCount = await spineHealthResultsCollection.countDocuments({
          timestamp:{$gte: startDate.getTime(), $lte: endDate.getTime()}
        });
        TotalSpineProgramScreens +=spineHealthResultsCount ;
        const soapDocs = await soapCollection.find({
          'updated.at': { $gte: startDate.getTime(), $lte: endDate.getTime() }
        }).toArray();
        
        for (const soapDoc of soapDocs) {
          const visitDetails = soapDoc.visit_details; 
          const assessmentAcuity = soapDoc.assessment?.acuity;
          const carePath = soapDoc.care_path;
          //acuity
          if (assessmentAcuity === 'acute') {
            acuteCount++;
          } else if (assessmentAcuity === 'chronic') {
            chronicCount++;
          }
          //visit_type
          if (visitDetails.visit_type === 'initial' || visitDetails.visit_type === 'followup') {
            const appointmentRefID = soapDoc.appointment_reference_id;
            const appointment = await appointmentsCollection.findOne({ reference: appointmentRefID });
            if (appointment) {
              const clinicianType = appointment.clinician?.type;
              if (visitDetails.visit_type === 'initial') {
                if (clinicianType === 'coach') {
                  initialCoachVisits++;
                } else if (clinicianType === 'physician') {
                  initialPhysicianVisits++;
                }
              } else if (visitDetails.visit_type === 'followup') {
                if (clinicianType === 'coach') {
                  followUpCoachVisits++;
                } else if (clinicianType === 'physician') {
                  followUpPhysicianVisits++;
                }
              }
            }
          }
        
          //carepath details
          if (carePath === 'rehab_program') {
            rehab_program++;
          } else if (carePath === 'uh_physician_visit') {
            physician_visit++;
          } else if (carePath === 'urgent_room') {
            urgent_room++;
          } else if (carePath === 'no_followup') {
            no_followup++;
          } else if (carePath === 'inperson_referral') {
            inperson_referral++;
          } else if (carePath === 'advice') {
            advice++;
          } else if (carePath === 'refer_navigator') {
            refer_navigator++;
          }
          //pain score
          const painLevel = soapDoc.subjective?.pain_level;
          if (painLevel !== undefined) {
            totalPainLevel += painLevel;  
            numberOfDocsConsidered++;
          }
        }
      }
      const totalAcuteAndChronicCount = acuteCount + chronicCount;
      const Acutepercentage = totalAcuteAndChronicCount !== 0 ? ((acuteCount / totalAcuteAndChronicCount) * 100).toFixed(2) + "%" : "0%";
      const Chronicpercentage = totalAcuteAndChronicCount !== 0 ? ((chronicCount / totalAcuteAndChronicCount) * 100).toFixed(2) + "%" : "0%";
      let averagePainLevel = 0;  
      if (numberOfDocsConsidered !== 0) {
        averagePainLevel = totalPainLevel / numberOfDocsConsidered;  
      }

      const totalCarePaths = rehab_program + physician_visit + urgent_room + no_followup + inperson_referral + advice + refer_navigator;
      const carePathResponse = {
        rehab_program: ((rehab_program / totalCarePaths) * 100).toFixed(2) + "%",
        physician_visit: ((physician_visit / totalCarePaths) * 100).toFixed(2) + "%",
        urgent_room: ((urgent_room / totalCarePaths) * 100).toFixed(2) + "%",
        no_followup: ((no_followup / totalCarePaths) * 100).toFixed(2) + "%",
        inperson_referral: ((inperson_referral / totalCarePaths) * 100).toFixed(2) + "%",
        advice: ((advice / totalCarePaths) * 100).toFixed(2) + "%",
        refer_navigator: ((refer_navigator / totalCarePaths) * 100).toFixed(2) + "%",
      };

      const countsResponse = {
        error: false,
        status: "COUNTS::SUCCESS",
        message: "counts fetched successfully",
        counts: {
          //new_accounts: newAccountsCount,
          initial_coach_visits: initialCoachVisits,
          followup_coach_visits: followUpCoachVisits,
          initial_physician_visits: initialPhysicianVisits,
          followup_physician_visits: followUpPhysicianVisits,
          average_initial_painscore: averagePainLevel,
          total_spineprogram_screens: TotalSpineProgramScreens
        },
        acuity: {
          chronic: chronicCount,
          acute: acuteCount,
          chronic_percentage: Chronicpercentage,
          acute_percentage: Acutepercentage,

        },
        carepath: carePathResponse
      };
      return res.status(200).send(countsResponse); 
    } catch (error) {
      console.error(error);
      return res.status(500).send({ success: false, message: 'An error occurred while processing counts' });
    } finally {
      await client.close();
    }
  })


  export const counts: RouteShorthandOptions = {
    schema: {
      body: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" }
        },
        required: ["start_date", "end_date"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            error: { type: "boolean" },
            status: { type: "string" },
            message: { type: "string" },
            counts: {
              type: "object",
              properties: {
                //new_accounts: { type: "integer" },
                initial_coach_visits: { type: "integer" },
                followup_coach_visits: { type: "integer" },
                initial_physician_visits: { type: "integer" },
                followup_physician_visits: { type: "integer" },
                average_initial_painscore: { type: "integer" },
                total_spineprogram_screens: { type: "integer" }
              },
              additionalProperties: false,
              required: [
                //"new_accounts",
                "initial_coach_visits",
                "followup_coach_visits",
                "initial_physician_visits",
                "followup_physician_visits",
                "average_initial_painscore",
                "total_spineprogram_screens"
              ],
            },
            acuity: {
              type: "object",
              properties: {
                chronic: { type: "integer" },
                acute: { type: "integer" },
                chronic_percentage: { type: "string" }, 
                acute_percentage: { type: "string" },   
              },
              required: [
                "chronic",
                "acute",
                "chronic_percentage",
                "acute_percentage",
              ],
            },
            carepath: {
              type: "object",
              properties: {
                physician_visit: { type: "string" },
                urgent_room: { type: "string" },
                no_followup: { type: "string" }, 
                inperson_referral: { type: "string" },   
                advice: { type: "string" }, 
                refer_navigator: { type: "string" }, 
                rehab_program:{ type: "string" }
              },
              required: [
                "rehab_program",
                "physician_visit",
                "urgent_room",
                "no_followup",
                "inperson_referral",
                "advice",
                "refer_navigator"
              ],
            },
          },
        },
        "4xx": { $ref: "RequestErrorSchema#" },
      },
    },
  };

