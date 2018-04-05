package main

import (
	"flag"
	"os"
	"log"
	"strings"

	uErr "Jarvis/errors"
	logHelpers "Jarvis/helpers/log"
	recoverHelpers "Jarvis/helpers/recover"
	"Jarvis/configs"
	"Jarvis/db"
	"Jarvis/store/redis"
	"Jarvis/service"
	"Jarvis/mail"
)

func main() {
	prod := flag.Bool("prod", false, "Run in production mode.")
	flag.Parse()

	// Run shutdown watchers.
	defer recoverHelpers.Watcher(shutdown)
	go recoverHelpers.ShutdownWatcher(shutdown)

	// Parse configs.
	conf, err := configs.Parse("./configs.toml")
	if err != nil {
		uErr.Fatal(err, "failed to parse configs")
	}

	// Setup prod env.
	dbConf := conf.DB["dev"]
	if *prod {
		dbConf = conf.DB["prod"]
		conf.Common.Dev = false

		err := logHelpers.SetupLogFile(conf.Common.LogOutPath)
		if err != nil {
			uErr.Fatal(err, "failed to setup log file")
		}
	}

	// Initiate database.
	err = db.Initiate(dbConf)
	if err != nil {
		uErr.Fatal(err, "failed to initialize DB")
	}
	defer db.Instance.Close()
	log.Println("Database client was set")


	// Initiate Redis client.
	pingResp, err := redis.Initiate(conf.Redis)
	if err != nil || strings.ToLower(pingResp) != "pong" {
		uErr.Fatal(err, "failed to initialize Redis client")
	}
	defer redis.Instance.Close()
	log.Println("Redis client was set")

	// Initiate mail client.
	mail.Initiate(conf.Mail)

	// Start gRPC server.
	go func() {
		log.Println("Start gRPC server on", conf.Server.GRPCPort, "port")
		if err := service.StartGRPCServer(conf.Server.GRPCPort); err != nil {
			uErr.Fatal(err, "failed to start gRPC server")
		}
	}()

	// Start REST server.
	log.Println("Start REST server on", conf.Server.RESTPort, "port")
	err = service.StartREST(conf.Server.RESTPort, conf.Server.GRPCPort, !*prod)
	if err != nil {
		uErr.Fatal(err, "failed to start REST server")
	}
}

func shutdown(fatal bool, r interface{}) {
	log.Println("Shutdown")
	if fatal {
		os.Exit(1)
	}
	os.Exit(0)
}
