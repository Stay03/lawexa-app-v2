# SSE Bug Reproduction — v2_stream Path

All tests below use `stream_mode: "v2_stream"`. Every response confirmed `"stream_mode": "v2_stream"` and SSE events had Redis Stream IDs (e.g., `1776100466439-0`). This is NOT the legacy BLPOP path — these bugs reproduce on the Redis Streams / XREADGROUP path.

## Setup

```bash
TOKEN_RAW="7739|qmHgke9nVTbab8QGZqrbHNwon2xKDMVvrfVLc7K0468cad15"
TOKEN_ENC="7739%7CqmHgke9nVTbab8QGZqrbHNwon2xKDMVvrfVLc7K0468cad15"
API="https://prod-api.lawexa.com"
```

## Step 1: Start a new conversation (get plan card)

```bash
curl -s -X POST "$API/api/chat" \
  -H "Authorization: Bearer $TOKEN_RAW" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "message": "Acts of the Case of the kidnapping case in Owerri, Imo State Sometime in January, 2026, Ogbologbo Bature, alias \"No dulling\" aged 25 years, as always conceived a plan to make quick money by kidnapping Paulinus, aged 9. He befriended the boy by buying him sweets for five days. The boy'\''s mother, Madam Nkechi, a widow, residing in Owerri, Imo State, noticed it and warned her son that Ogbologbo was a never do well. On 17th February, 2026, just about seven days after his mother'\''s warning, Paulinus was nowhere to be found. After a failed frantic search, Madam Nkechi reported the matter at Owerri Police Station. Her report was documented and her statement was recorded. The DPO constituted a team comprising of ASP Edikan Onmonya, the lead investigator, Inspector Audu Abikan, and Sergeant Otse Adadu who were detailed to investigate. Four days after the incident, following a tip-off, the Policemen went and secured a detachment of well-armed mobile policemen from the Anambra State Police Command and proceeded to the Second Niger Bridge head at Onitsha. They cordoned off a Lagos bound bus at about 11.00pm and found Ogbologbo with the boy inside the bus. Despite Ogbologbo'\''s submission, they frisked his body and found a locally fabricated gun and three bullets. They dragged him out of the bus, shackled his feet, handcuffed him, dumped him into the boot of their unmarked Honda Pilot car, locked the boot, and drove off to Owerri with him and the boy. While he was inside the boot, Sergeant Adadu shouted to him why exactly was he taking the boy to Lagos and Ogbologbo orally admitted that he intended to sell the boy to a cartel led by Dr Igago Oke, the Medical Director of Japa Hospital, Ajegunle, Lagos. The next day, ASP Edikan Onmonya, Inspector Audu Abikan, and Sergeant Otse Adadu set out to Lagos on manhunt of the members of the cartel. To make their work easy, they decided to travel with Ogbologbo to act as a pointer. They reported at the Lagos State Police Command Ikeja before proceeding to Japa Hospital in Ajegunle. On getting to Japa Hospital, they met Master Ideyi Ikere, a 15 years old boy stationed at the gate of the Hospital by members of the cartel to monitor any unknown face coming to the hospital and to inform them. On sighting the Police team, Master Ideyi rushed into the Hospital, but before he could lock the gate, Sergeant Otse forced his way in, paving way for other members of the team and Ogbologbo to enter. On getting to the premises of the hospital, the whole place was filled with offensive odours of cannabis sativa and a terribly disturbing stench of a decomposing animal. On entering the office of Dr. Igago Oke, the police team saw Dr. Oke and other three men later identified as Major Chere Alaba, Lt. Colonel Ire Imota and ACP. Oye Ikeme (custom officer) smoking cannabis sativa. Ogbologbo quickly pointed at them as members of the cartel and they were all arrested. Ogbologbo informed the police that it remained two French nationals, Oscar Lille, and Thierry Carlton, whom he claimed were part of the cartel. Upon enquiry, it was discovered that Lille and Carlton are the buyers of the organs harvested from Ogbologbo'\''s victims sold to Dr. Igago Oke. Also, it was discovered that Major Chere Alaba, Lt. Colonel Ire Imota and ACP. Oye Ikeme usually provides security and clear the way for Oscar Lille, and Thierry Carlton to enable them cross Seme border with the human parts without arrest. The Police later discovered that the stench was coming from a soak away pit at the back of the hospital. They compelled Dr. Igago Oke to open the pit, and discovered with utter shock not less than twenty (20) dead human bodies inside. Afterwards, the Police proceeded to Agbara in Ogun State, where Oscar Lille, and Thierry Carlton lodged in a hotel and arrested them. After investigation the police transferred Major Chere Alaba, Lt. Colonel Ire Imota and ACP. Oye Ikeme to the Nigerian Army for Court Martial. Also, the Attorney General of Lagos State filed charges of kidnapping and murder against Ogbologbo Bature, Dr. Igago Oke, Master Ideyi Ikere, Oscar Lille, and Thierry Carlton at the High Court of Lagos State. The defense Counsel, Mr. Aare Kalama objected to the jurisdiction of the Court on the basis that the offences of Kidnapping and murder did not take place in Lagos and that not all the parties can be charged in Lagos for both offences. He further argued that Mr. Oscar Lille, and Mr. Thierry Carlton can only be tried by the International Criminal Court because they are not Nigerians. Brigadier Akeem Ningi, the General Officer Commanding the 81 Division of the Nigerian Army Lagos on 11th March, 2026 instructed Lt. Colonel Bayo Dantsoho orally to convene a Special Court Martial to try Major Chere Alaba, Lt. Colonel Ire Imota and ACP. Oye Ikeme. Eight days later Brigadier Akeem Ningi confirmed his instruction in writing. The members of the Court Martial were Colonel Uche Orons the most senior administrative officer at the Command and Lt. Colonel Agbalaka Boboye his deputy as member; Brigadier Akeem Ningi is the President of the Special Court Martial; Mrs. Iye Bongo as Judge Advocate. Also, Magistrate Waheed Ijere was appointed as the Coroner by the Lagos State Government for an inquest on the dead bodies discovered in the soak away pit. The Magistrate instead embarked on the trial of Dr. Oke and subsequently convicted Dr. Oke of murder and sentenced him accordingly. With the aid of statutory and judicial authorities answer the following questions; (a)Write a short note on: (i)the propriety or otherwise of charging Ideyi Ikere together with others for offences of Kidnapping and Murder in the above scenario. (ii)the validity of the objection on the jurisdiction of the High Court of Lagos State on the reasons canvassed for the objection. (b)Which of the offence(s) disclosed in the scenario can be tried by the Federal High Court? Can such offence(s) be tried by any of the Divisions of the Federal High Court in Nigeria? Give reasons for your answer. (c) Comment on the propriety or otherwise of the jurisdiction of the ICC to try Mr. Oscar Lille, and Mr. Thierry Carlton as argued by Mr. Aare Kalama. Assuming ICC has jurisdiction, where is the venue and what are the procedures for institution of such proceedings in the ICC? (d)Comment on the jurisdiction of the Court Martial to try the three named persons? (e)Assuming the Federal High Court also has jurisdiction over the offence alleged against Major Chere Alaba, and Lt. Colonel Ire Imota, could they have elected to be tried by the Federal High Court? Give reasons for your answer. (f)What is the validity of the instruction given to Lt. Colonel Bayo Dantsoho to convene the Court Martial? (g)Comment on the propriety or otherwise of the constitution and composition of the Special Court Martial. (i)Assuming the Attorney General of the Federation appears to take over the prosecution of the case at the Court Martial, comment on the validity of such action. (j)Assuming the offences in this case occurred in 2022 and Major Chere Alaba and Lt. Colonel Ire Imota retired a year later, briefly comment on the jurisdiction of the Court Martial to try them. (l)Comment on the propriety or otherwise of the proceedings of the coroner in the above scenario including the conviction and sentence of Dr. Oke. (m)Briefly comment on the Criminal jurisdiction of the National Industrial Court and the Code of Conduct Tribunal",
    "stream": true,
    "stream_mode": "v2_stream",
    "workflow_id": 12
  }'
```

**Response** (save `conversation_id` and `execution_id`):
```json
{
  "conversation_id": "af002947-e2df-4d1d-9ac9-64fc449d57f4",
  "execution_id": "4ab1e293-6158-4975-932e-fdcdc7848ea1",
  "stream_mode": "v2_stream"
}
```

## Step 2: Consume the plan card (fast, completes in ~3s)

```bash
EXEC_ID="4ab1e293-6158-4975-932e-fdcdc7848ea1"
timeout 15 curl -s -N "$API/api/chat/stream/${EXEC_ID}?token=${TOKEN_ENC}"
```

**Result**: `connected → completed → end` with `<multi_question_plan>` XML content. This is correct — the plan card is a quick response.

## Step 3: Send "Begin" to trigger sub-agent research

```bash
CONV_ID="af002947-e2df-4d1d-9ac9-64fc449d57f4"
curl -s -X POST "$API/api/chat" \
  -H "Authorization: Bearer $TOKEN_RAW" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"message\": \"Begin\",
    \"stream\": true,
    \"stream_mode\": \"v2_stream\",
    \"conversation_id\": \"$CONV_ID\",
    \"workflow_id\": 12
  }"
```

**Response** (save new `execution_id`):
```json
{
  "execution_id": "556dc07a-5ec2-4458-86a7-2371984e182c",
  "stream_mode": "v2_stream"
}
```

## Step 4: Tab 1 — consume 7 seconds then disconnect

This simulates a user refreshing the page mid-stream.

```bash
EXEC_ID="556dc07a-5ec2-4458-86a7-2371984e182c"
timeout 7 curl -s -N "$API/api/chat/stream/${EXEC_ID}?token=${TOKEN_ENC}" > tab1.txt
```

**Our result**:
```
Events: 45
Seq range: 1–43
Event types: 42 text_delta, 1 iteration, 1 heartbeat, 1 connected
No completed, no end (still running)
```

All events had Redis Stream IDs (`id: 1776100466439-0` etc.), confirming v2_stream path.

## Step 5: Check status

```bash
curl -s "$API/api/conversations/$CONV_ID/status" \
  -H "Authorization: Bearer $TOKEN_RAW" \
  -H "Accept: application/json"
```

**Our result**:
```json
{
  "status": "pending",
  "execution_id": "124c548e-db89-4da4-8e8d-07ff5f9be2ab"   // <-- DIFFERENT from 556dc07a!
}
```

**BUG 3 reproduced**: Execution ID changed from `556dc07a` to `124c548e` while still pending.

## Step 6: Tab 2A — reconnect to ORIGINAL execution ID

```bash
ORIG_EXEC="556dc07a-5ec2-4458-86a7-2371984e182c"
timeout 10 curl -s -N "$API/api/chat/stream/${ORIG_EXEC}?token=${TOKEN_ENC}" > tab2a.txt
```

**Our result**:
```
Events: 885
Event types: 874 text_delta, 2 handover_started, 2 handover_complete,
             2 tool_calling, 2 text_reset, 2 text_done, 1 connected
NO completed, NO end
```

**BUG 1+2 reproduced**: Tab 2A got live events (proving v2_stream path was active) but:
- Started later in the stream (events Tab 1 consumed are gone — shared consumer)
- Never received `completed` or `end` — stream just stopped

## Step 7: Tab 2B — connect to NEW execution ID from status

```bash
NEW_EXEC="124c548e-db89-4da4-8e8d-07ff5f9be2ab"
timeout 10 curl -s -N "$API/api/chat/stream/${NEW_EXEC}?token=${TOKEN_ENC}" > tab2b.txt
```

**Our result**:
```
Events: 3
event: connected
event: completed   ← instant, content is issue-spotter sub-agent's refusal
event: end
```

**BUG 4+5 reproduced**: Instant false `completed` with the issue-spotter's response:
> "I cannot provide a comprehensive legal analysis, explain the elements of crimes, or answer the specific questions..."

This sub-agent refusal was returned as the final answer.

---

## Summary of What We Observed

```
Timeline:
  T+0s   POST /api/chat → exec_id: 556dc07a (v2_stream confirmed)
  T+0s   Tab 1 connects to 556dc07a, receives events seq 1–43
  T+7s   Tab 1 disconnects (simulating page refresh)
  T+10s  GET /status → status: pending, exec_id: 124c548e (ROTATED!)
  T+10s  Tab 2A connects to 556dc07a → gets 885 live events, NO terminal
  T+20s  Tab 2B connects to 124c548e → instant false completed with sub-agent content
  T+25s  GET /status → status: pending, exec_id: 93863dee (ROTATED AGAIN!)
```

All on `stream_mode: "v2_stream"`. Redis Stream IDs present on all events. This is not the legacy BLPOP path.

### Root causes confirmed

| Bug | What | Root cause |
|-----|------|-----------|
| 1+2 | Lost events + no terminal on reconnect | Shared consumer name `sse-{executionId}` — Tab 1 ACKs events, Tab 2's XREADGROUP skips them |
| 3 | Execution ID rotation | `$conversation->aiRequests()->latest()` returns specialist's request, not orchestrator's |
| 4+5 | False completed with wrong content | Connecting to specialist's exec ID → its AiResponse (sub-agent output) returned as final |
