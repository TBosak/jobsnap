#!/bin/bash
# Comprehensive templatization of document.xml

# Contact Information
sed -i 's/TIMOTHY M\. BARANI/{{FULL_NAME}}/g' document.xml
sed -i 's/Timothy Barani/{{FULL_NAME}}/g' document.xml
sed -i 's/573\.225\.6518/{{PHONE}}/g' document.xml
sed -i 's/timb63701@gmail\.com/{{EMAIL}}/g' document.xml
sed -i 's|https://www\.timbarani\.com/|{{WEBSITE}}|g' document.xml
sed -i 's|https://www\.linkedin\.com/in/tbarani/|{{LINKEDIN_URL}}|g' document.xml

# Job Title
sed -i 's/SOFTWARE ENGINEER/{{JOB_TITLE}}/g' document.xml

# Summary
sed -i 's/Software Engineer experienced in building scalable, human-centered applications\. Skilled in developing healthcare technology solutions, strengthening authentication systems, and delivering data-driven applications that improve organizational efficiency\. Recognized for creating innovative tools that streamline wo/{{SUMMARY_PART1}}/g' document.xml
sed -i 's/rkflows and enhance outcomes\. T/{{SUMMARY_PART2}}/g' document.xml
sed -i 's/hrive on continuous learning, creative problem-solving, and building solutions that are both technically sound and /{{SUMMARY_PART3}}/g' document.xml
sed -i 's/people focused/{{SUMMARY_PART4}}/g' document.xml

# Skills - individual items
sed -i 's/>Angular</>{{SKILL_1}}</g' document.xml
sed -i 's/>Azure</>{{SKILL_2}}</g' document.xml
sed -i 's/>Node\.js</>{{SKILL_3}}</g' document.xml
sed -i 's/>Identity Server</>{{SKILL_4}}</g' document.xml
sed -i 's/>SQL</>{{SKILL_5}}</g' document.xml
sed -i 's/>\.NET\/</>{{SKILL_6}}</g' document.xml
sed -i 's/>C#</>{{SKILL_7}}</g' document.xml
sed -i 's/>API Development</>{{SKILL_8}}</g' document.xml
sed -i 's/>Azure Databricks</>{{SKILL_9}}</g' document.xml
sed -i 's/>Databricks</>{{SKILL_9}}</g' document.xml
sed -i 's/>TypeScript</>{{SKILL_10}}</g' document.xml
sed -i 's/>Agile Methodologies</>{{SKILL_11}}</g' document.xml
sed -i 's/>Git</>{{SKILL_12}}</g' document.xml
sed -i 's/>CSS</>{{SKILL_13}}</g' document.xml
sed -i 's/>HTML</>{{SKILL_14}}</g' document.xml
sed -i 's/>Okta</>{{SKILL_15}}</g' document.xml
sed -i 's/>Data-driven Applications</>{{SKILL_16}}</g' document.xml
sed -i 's/>Software Development</>{{SKILL_17}}</g' document.xml
sed -i 's/>Docker</>{{SKILL_18}}</g' document.xml
sed -i 's/>Pulumi</>{{SKILL_19}}</g' document.xml

# Work Experience 1 - Vizient
sed -i 's/VIZIENT, INC\., /{{COMPANY_1}}, /g' document.xml
sed -i 's/Cape Girardeau, MO/{{LOCATION_1}}/g' document.xml
sed -i 's/2019-Sep/{{START_DATE_1}}/g' document.xml
sed -i 's/2025/{{END_DATE_1}}/g' document.xml

# Education
sed -i 's/Bachelor of Arts, Southeast Missouri State University, Cape Girardeau, MO/{{EDUCATION}}/g' document.xml
sed -i 's/Southeast Missouri State University/{{UNIVERSITY}}/g' document.xml

# Certifications
sed -i 's/#1087958/{{CERT_NUMBER_1}}/g' document.xml
sed -i 's/#144079813371183/{{CERT_NUMBER_2}}/g' document.xml

echo "Templatization complete!"
