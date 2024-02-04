.post("/assign_painlevel", Schemas.pain, async (req, rep) => {
      const { reference, pain_level, difficulty_level } = req.body as StringObject;
      try {
        let program = await dtarget(req, "assigned_programs").findOne({ reference: reference });
        if (!program) {
          return rep.code(404).send({
            error: true,
            status: "ASSIGNED_PROGRAM::NOT_FOUND",
            message: "Program Not Found",
          });
        }
    
        program.pain_level = pain_level;
        program.difficulty_level = difficulty_level;

        await dtarget(req, "assigned_programs").updateOne(
          { reference: reference },
          { $set: { pain_level: pain_level, difficulty_level: difficulty_level } }
        );
        return rep.send({
          success: true,
          message: "Pain level and difficulty level assigned successfully",
        });
      } catch (error) {
        console.error(error);
        return rep.code(500).send({
          error: true,
          status: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while assigning pain level and difficulty level",
        });
      }
})



export const pain: RouteShorthandOptions = {
  schema: {
    body: {
      type: "object",
      properties: {
        reference: { type: "string" },
        pain_level: { type: "number" },
        difficulty_level: { type: "number" }
      },
      required: ["reference", "pain_level", "difficulty_level"]
    },
    response: {
      200: {
        type: "object",
        properties: {
          error: { type: "boolean" },
          status: { type: "string" },
          message: { type: "string" } 
        },
      },
      "4xx": { $ref: "RequestErrorSchema#" },
    },
  },
};   