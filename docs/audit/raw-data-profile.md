# Raw Data Profile (machine-readable also at data/metadata/raw_data_profile.json)

Generated: 2026-08-30T11:18:31.681079+00:00

{
  "generated_at": "2026-08-30T11:18:31.681079+00:00",
  "datasets": [
    {
      "path": "C:\\Hackathons\\Latent Code\\RETAINAI - AI Customer Rescue Agent\\data\\raw\\helpdesk_tickets.csv",
      "row_count": 10,
      "column_count": 4,
      "column_names": [
        "id",
        "subject",
        "priority",
        "category"
      ],
      "data_types": {
        "id": "string",
        "subject": "string",
        "priority": "string",
        "category": "string"
      },
      "missing_values": {
        "id": 0,
        "subject": 0,
        "priority": 0,
        "category": 0
      },
      "duplicate_rows": 0,
      "duplicate_ids": 0,
      "unique_values": {
        "id": 10,
        "subject": 10,
        "priority": 2,
        "category": 3
      },
      "categorical_cardinality": {
        "id": 10,
        "subject": 10,
        "priority": 2,
        "category": 3
      },
      "numerical_ranges": {},
      "date_ranges": {},
      "malformed_values": 0,
      "invalid_encodings": 0,
      "suspicious_values": [],
      "priority_distribution": {
        "Medium": 3,
        "High": 7
      },
      "category_distribution": {
        "Network": 3,
        "Software": 5,
        "Security": 2
      },
      "sample_rows": [
        {
          "id": "1aiu3lrqi",
          "subject": "Hey IT! Our network printer keeps disconnecting.",
          "priority": "Medium",
          "category": "Network"
        },
        {
          "id": "kz5mjjpox",
          "subject": "Access Issue with Shared Network Drive",
          "priority": "High",
          "category": "Network"
        },
        {
          "id": "86eza0fwq",
          "subject": "Software Conflict Causing App Crashes",
          "priority": "High",
          "category": "Software"
        }
      ]
    }
  ]
}