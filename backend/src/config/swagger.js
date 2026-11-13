const swaggerJsdoc =
    require("swagger-jsdoc");


const options = {

    definition: {

        openapi: "3.0.0",

        info: {

            title:
                "Online Learning Platform API",

            version:
                "1.0.0",

            description:
                "Online Learning Platform Backend API"

        },

        servers: [

            {

                url:
                    "http://localhost:5000",

                description:
                    "Local development server"

            }

        ],

        components: {

            securitySchemes: {

                bearerAuth: {

                    type:
                        "http",

                    scheme:
                        "bearer",

                    bearerFormat:
                        "JWT"

                }

            }

        }

    },

    apis: [

        "./src/routes/*.js"

    ]

};



const swaggerSpec =
    swaggerJsdoc(options);


module.exports =
    swaggerSpec;








    