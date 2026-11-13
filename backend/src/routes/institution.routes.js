
const express = require("express");
const controller = require("../controller/institution.controller");
const {
    authenticate,
    requireRoleOrPermission
} = require("../middleware/auth.middleware");
const { uploadInstitutionLogo } = require("../middleware/upload.middleware");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Institution:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "1"
 *           description: PostgreSQL BIGINT ID returned as a string.
 *         code:
 *           type: string
 *           maxLength: 50
 *           example: "INST-CHN-001"
 *         name:
 *           type: string
 *           maxLength: 200
 *           example: "Learnova Institute of Technology"
 *         institution_type:
 *           type: string
 *           nullable: true
 *           maxLength: 50
 *           example: "College"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Institution for technology and professional learning."
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           example: "contact@example.com"
 *         phone_number:
 *           type: string
 *           nullable: true
 *           maxLength: 30
 *           example: "+91-9876543210"
 *         website_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com"
 *         address_line1:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "100 Anna Salai"
 *         address_line2:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "Teynampet"
 *         city:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "Chennai"
 *         state:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "Tamil Nadu"
 *         postal_code:
 *           type: string
 *           nullable: true
 *           maxLength: 20
 *           example: "600018"
 *         country:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "India"
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/logo.png"
 *         is_active:
 *           type: boolean
 *           example: true
 *     InstitutionInput:
 *       type: object
 *       required:
 *         - code
 *         - name
 *       properties:
 *         code:
 *           type: string
 *           maxLength: 50
 *           example: "INST-CHN-001"
 *         name:
 *           type: string
 *           maxLength: 200
 *           example: "Learnova Institute of Technology"
 *         institution_type:
 *           type: string
 *           nullable: true
 *           maxLength: 50
 *           example: "College"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Institution for technology and professional learning."
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           maxLength: 255
 *           example: "contact@example.com"
 *         phone_number:
 *           type: string
 *           nullable: true
 *           maxLength: 30
 *           example: "+91-9876543210"
 *         website_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com"
 *         address_line1:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "100 Anna Salai"
 *         address_line2:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "Teynampet"
 *         city:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "Chennai"
 *         state:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "Tamil Nadu"
 *         postal_code:
 *           type: string
 *           nullable: true
 *           maxLength: 20
 *           example: "600018"
 *         country:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "India"
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/logo.png"
 *         is_active:
 *           type: boolean
 *           example: true
 *     InstitutionUpdate:
 *       type: object
 *       minProperties: 1
 *       description: >
 *         Supply one or more editable fields. Omitted fields remain unchanged.
 *         Use null to clear nullable fields.
 *       properties:
 *         code:
 *           type: string
 *           maxLength: 50
 *           example: "INST-CHN-001"
 *         name:
 *           type: string
 *           maxLength: 200
 *           example: "Learnova Institute of Technology"
 *         institution_type:
 *           type: string
 *           nullable: true
 *           maxLength: 50
 *           example: "College"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Updated institution description."
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           maxLength: 255
 *           example: "contact@example.com"
 *         phone_number:
 *           type: string
 *           nullable: true
 *           maxLength: 30
 *           example: "+91-9876543210"
 *         website_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com"
 *         address_line1:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "100 Anna Salai"
 *         address_line2:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: "Teynampet"
 *         city:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "Chennai"
 *         state:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "Tamil Nadu"
 *         postal_code:
 *           type: string
 *           nullable: true
 *           maxLength: 20
 *           example: "600018"
 *         country:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "India"
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://example.com/logo.png"
 *         is_active:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/institutions:
 *   post:
 *     summary: Create an institution
 *     tags: [Institutions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InstitutionInput'
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstitutionInput'
 *               - type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                     format: binary
 *     responses:
 *       201:
 *         description: Institution created successfully
 *       400:
 *         description: Invalid request data
 *       409:
 *         description: Institution code or name already exists
 *   get:
 *     summary: Get institutions
 *     tags: [Institutions]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search institution code, name, type, email, city, state or country.
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Institutions retrieved successfully
 */

/**
 * @swagger
 * /api/institutions/{id}:
 *   get:
 *     summary: Get an institution by ID
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         description: PostgreSQL BIGINT ID.
 *     responses:
 *       200:
 *         description: Institution retrieved successfully
 *       400:
 *         description: Invalid institution ID
 *       404:
 *         description: Institution not found
 *   put:
 *     summary: Update institution fields
 *     description: >
 *       All business fields are supported. Send any combination of fields;
 *       omitted fields remain unchanged. Use null to clear nullable fields.
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *         description: PostgreSQL BIGINT ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InstitutionUpdate'
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstitutionUpdate'
 *               - type: object
 *                 properties:
 *                   logo:
 *                     type: string
 *                     format: binary
 *     responses:
 *       200:
 *         description: Institution updated successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Institution not found
 *       409:
 *         description: Institution code or name already exists
 *   delete:
 *     summary: Soft-delete an institution
 *     tags: [Institutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[1-9][0-9]*$'
 *     responses:
 *       200:
 *         description: Institution deleted successfully
 *       404:
 *         description: Institution not found
 */

router.post(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "INSTITUTION_CREATE"),
    uploadInstitutionLogo,
    controller.createInstitution
);
router.get(
    "/",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "INSTITUTION_VIEW"),
    controller.getInstitutions
);
router.get(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "INSTITUTION_VIEW"),
    controller.getInstitutionById
);
router.put(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "INSTITUTION_UPDATE"),
    uploadInstitutionLogo,
    controller.updateInstitution
);
router.delete(
    "/:id",
    authenticate,
    requireRoleOrPermission(["ADMIN"], "INSTITUTION_DELETE"),
    controller.deleteInstitution
);

module.exports = router;
