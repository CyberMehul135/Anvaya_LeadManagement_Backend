const express = require("express");
const app = express();
const { initialDatabase } = require("./db/db.connect");
const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
};

const SalesAgent = require("./models/salesAgent.models");
const Lead = require("./models/lead.models");
const Comment = require("./models/comment.models");
const { default: mongoose } = require("mongoose");

initialDatabase();

// MIDDLEWARES
app.use(express.json());
app.use(cors(corsOptions));

// ROUTES :
// [ 1 ] AGENTS API :
// (1) AGENTS : CREATE
async function createAgent(agentData) {
  try {
    const { name, email } = agentData;
    // INPUT VALIDATION
    if (!name || !name.trim()) {
      const err = new Error("Invalid input: 'name' is required");
      err.statusCode = 400;
      throw err;
    }

    // EMAIL VALIDATION
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      const err = new Error(
        "Invalid input: 'email' must be a valid email address."
      );
      err.statusCode = 400;
      throw err;
    }

    // CHECK IF EMAIL ALREADY EXIST
    const existingAgent = await SalesAgent.findOne({ email: email });
    if (existingAgent) {
      const err = new Error(
        `Sales agent with email '${email}' already exists.`
      );
      err.statusCode = 409;
      throw err;
    }

    const newAgent = new SalesAgent(agentData);
    const saveAgent = await newAgent.save();
    return saveAgent;
  } catch (error) {
    throw error;
  }
}

app.post("/api/agents", async (req, res) => {
  try {
    const savedAgent = await createAgent(req.body);
    res
      .status(201)
      .json({ message: "Agent created Successfully.", savedAgent });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    if (error.statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }

    res
      .status(500)
      .json({ error: "Failed to create new agent. Please try again." });
  }
});

// (2) AGENTS : GET-ALL
async function readAllAgents() {
  try {
    const agents = await SalesAgent.find();
    return agents;
  } catch (error) {
    throw error;
  }
}

app.get("/api/agents", async (req, res) => {
  try {
    const agents = await readAllAgents();
    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agents." });
  }
});

// [ 2 ] LEADS API :
// (1) LEADS : CREATE
async function createLead(leadData) {
  try {
    const { salesAgent } = leadData;
    // VALIDATE OBJECT-ID
    if (!mongoose.Types.ObjectId.isValid(salesAgent)) {
      const err = new Error("Invalid SalesAgent ID format.");
      err.statusCode = 400;
      throw err;
    }

    // CHECK SALESAGENT EXIST
    const salesAgentExist = await SalesAgent.findById(salesAgent);
    if (!salesAgentExist) {
      const err = new Error(`Sales agent with ID '${salesAgent}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // CREATE & SAVE LEAD
    const newLead = new Lead(leadData);
    const saveLead = await newLead.save();
    return saveLead;
  } catch (error) {
    // VALIDATION ERRORS
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((val) => val.message);
      const err = new Error(message.join(", "));
      err.statusCode = 400;
      throw err;
    }

    throw error;
  }
}

app.post("/api/leads", async (req, res) => {
  try {
    const savedLead = await createLead(req.body);
    res.status(201).json({ message: "Lead created successfully.", savedLead });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }

    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to create lead." });
  }
});

// (2) LEADS : UPDATE-BY-ID
async function updateLeadById(leadId, dataToUpdate) {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(leadId, dataToUpdate, {
      new: true,
      runValidators: true, // Imp to trigger schema-validations
    });

    //  CHECK IF LEAD EXIST
    if (!updatedLead) {
      const err = new Error(`Lead with ID '${leadId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return updatedLead;
  } catch (error) {
    // VALIDATIONS ERROR
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((val) => val.message);
      const err = new Error(message.join(", "));
      err.statusCode = 400;
      throw err;
    }

    throw error;
  }
}

app.post("/api/leads/:leadId", async (req, res) => {
  try {
    const updatedLead = await updateLeadById(req.params.leadId, req.body);
    if (updatedLead) {
      res
        .status(200)
        .json({ message: "Lead updated successfully.", updatedLead });
    }
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to update a lead." });
  }
});

// (3) LEADS : DELETE-BY-ID
async function deleteById(leadId) {
  try {
    const deletedLead = await Lead.findByIdAndDelete(leadId);

    // CHECK IF LEAD EXIST
    if (!deletedLead) {
      const err = new Error(`Lead with ID '${leadId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    return deletedLead;
  } catch (error) {
    throw error;
  }
}

app.delete("/api/leads/:leadId", async (req, res) => {
  try {
    const deletedLead = await deleteById(req.params.leadId);
    res
      .status(200)
      .json({ message: "Lead deleted successfully.", deletedLead });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to delete lead." });
  }
});

// (4) LEADS : GET-ALL & BY-QUERY (FILTERATION)
async function readLeadsByQuery(leadQuery) {
  try {
    const { status, agent, sort } = leadQuery;

    const filter = {};
    if (status) filter.status = status;
    if (agent) filter.salesAgent = agent;

    let query = Lead.find(filter).populate("salesAgent");

    // [ 1 ] Normal Sorting (if schema-key "have" data-type : Number/Date)
    // ( schema-key = createdAt, timeToClose )
    if (sort === "asc") query = query.sort({ createdAt: 1 });
    if (sort === "desc") query = query.sort({ createdAt: -1 });
    if (sort === "timeToClose") query = query.sort({ timeToClose: 1 });

    // [ 2 ] Custom Sorting ( if schema-key "dont-have" data-type: Number/Date) ( first addFields : 1(Number-type) then sort.)
    // ( Schema-key = priority )
    if (sort === "priority") {
      const leads = await Lead.aggregate([
        { $match: filter },
        {
          $addFields: {
            priorityOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$priority", "High"] }, then: 1 },
                  { case: { $eq: ["$priority", "Medium"] }, then: 2 },
                  { case: { $eq: ["$priority", "Low"] }, then: 3 },
                ],
                default: 4,
              },
            },
          },
        },
        { $sort: { priorityOrder: 1 } },
        {
          $lookup: {
            from: "salesagents", // dusri collection ka naam
            localField: "salesAgent", // current collection ka field
            foreignField: "_id", // dusri collection me match karne wala field
            as: "salesAgent", // result me kis naam se save karna hai
          },
        },
        { $unwind: { path: "$salesAgent", preserveNullAndEmptyArrays: true } },
      ]);

      return leads;
    }

    const leads = await query;
    return leads;
  } catch (error) {
    throw error;
  }
}

app.get("/api/leads", async (req, res) => {
  try {
    const leadsByQuery = await readLeadsByQuery(req.query);
    res.status(200).json(leadsByQuery);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

// (5) LEAD : GET-BY-ID
async function readLeadById(leadId) {
  try {
    const leadById = await Lead.findById(leadId).populate("salesAgent");
    return leadById;
  } catch (error) {
    console.log(error);
  }
}

app.get("/api/leads/:leadId", async (req, res) => {
  try {
    const leadById = await readLeadById(req.params.leadId);
    if (leadById) {
      return res.status(200).json(leadById);
    }
  } catch (error) {
    res.status(500).json({ error: "Faild to fetch leads." });
  }
});

// [ 3 ] COMMENTS API :
// (1) COMMENT : CREATE
async function createComment(newCommentData) {
  try {
    const { lead, author } = newCommentData;
    // VALIDATE OBJECT-ID
    if (!mongoose.Types.ObjectId.isValid(lead)) {
      const err = new Error("Invalid Lead ID format.");
      err.statusCode = 400;
      throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(author)) {
      const err = new Error("Invalid SalesAgent ID format.");
      err.statusCode = 400;
      throw err;
    }

    // CHECK LEAD EXIST
    const leadExist = await Lead.findById(lead);
    if (!leadExist) {
      const err = new Error(`Lead with Id ${lead} not found.`);
      err.statusCode = 404;
      throw err;
    }

    // CHECK AGENT EXIST
    const agentExist = await SalesAgent.findById(author);
    if (!agentExist) {
      const err = new Error(`SalesAgent with Id ${author} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const newComment = new Comment(newCommentData);
    const saveComment = await newComment.save();
    return saveComment;
  } catch (error) {
    // validation error :
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors).map((val) => val.message);
      const err = new Error(message.join(", "));
      err.statusCode = 400;
      throw err;
    }

    throw error;
  }
}

app.post("/api/leads/:id/comments", async (req, res) => {
  try {
    const newComment = await createComment(req.body);
    res
      .status(201)
      .json({ message: "Comment added successfully.", newComment });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create comment." });
  }
});

// (2) COMMENT : GET-ALL
async function readAllComments(leadId) {
  try {
    // VALIDATE OBJECT-ID
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      const err = new Error("Invalid Lead ID format.");
      err.statusCode = 400;
      throw err;
    }

    // LEAD EXIST
    const leadExist = await Lead.findById(leadId);
    if (!leadExist) {
      const err = new Error(`Lead with Id ${leadId} not found.`);
      err.statusCode = 404;
      throw err;
    }

    const comments = await Comment.find({ lead: leadId }).populate("author");
    return comments;
  } catch (error) {
    throw error;
  }
}

app.get("/api/leads/:id/comments", async (req, res) => {
  try {
    const comments = await readAllComments(req.params.id);
    res.status(200).json({ message: "Comments fetch successfully.", comments });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

// [ 4 ] REPORT API :
// (1) REPORT : GET-LASTWEEK.CLOSED.LEADS
async function readLeadsClosedLastWeek() {
  try {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    // Closed Leads Last-week :
    const leads = await Lead.find({
      closedAt: { $gte: lastWeek, $lte: today },
    }).select("name salesAgent closedAt");
    return leads;
  } catch (error) {
    throw error;
  }
}

app.get("/api/report/last-week", async (req, res) => {
  try {
    const leads = await readLeadsClosedLastWeek();
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch last week closed leads." });
  }
});

// (2) REPORT : GET-ALL.LEADS.IN.PIPELINE
async function readLeadInPipeline() {
  try {
    const leadsInPipeline = await Lead.find({ status: { $ne: "Closed" } });
    return leadsInPipeline;
  } catch (error) {
    throw error;
  }
}

app.get("/api/report/pipeline", async (req, res) => {
  try {
    const leads = await readLeadInPipeline();
    res.status(200).json({ totalLeadsInPipeline: leads.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leads in pipeline." });
  }
});

// (3) REPORT : GET-LEADS-BY-GROUP(STATUS)
async function readLeadCountByStatus() {
  try {
    const result = await Lead.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    return result;
  } catch (error) {
    throw error;
  }
}

app.get("/api/report/status-count", async (req, res) => {
  try {
    const leadCountByStatus = await readLeadCountByStatus();
    res.status(200).json(leadCountByStatus);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead count by status." });
  }
});

// (4) REPORT : GET-LEADS-BY-GROUP(AGENT)
async function readLeadCountByAgent() {
  try {
    const result = await Lead.aggregate([
      // Main Logic
      {
        $group: {
          _id: "$salesAgent",
          closedLeadCount: {
            $sum: { $cond: [{ $eq: ["$status", "Closed"] }, 1, 0] },
          },
          pipelineLeadCount: {
            $sum: { $cond: [{ $ne: ["$status", "Closed"] }, 1, 0] },
          },
        },
      },
      // Secondary (for showing agentname)
      {
        $lookup: {
          from: "salesagents",
          localField: "_id",
          foreignField: "_id",
          as: "agentDetails",
        },
      },
      { $unwind: "$agentDetails" },
      {
        $project: {
          _id: 0,
          agentId: "$agentDetails._id",
          agentName: "$agentDetails.name",
          closedLeadCount: 1,
          pipelineLeadCount: 1,
        },
      },
    ]);

    return result;
  } catch (error) {
    throw error;
  }
}

app.get("/api/report/agent-count", async (req, res) => {
  try {
    const leadCountByAgent = await readLeadCountByAgent();
    res.status(200).json(leadCountByAgent);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead count by agent." });
  }
});

// SERVER STARTER :
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
