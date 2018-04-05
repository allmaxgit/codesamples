package service

import (
	"net"
	"fmt"
	"os"
	"net/http"

	gRPCMiddleware "github.com/grpc-ecosystem/go-grpc-middleware"
	gRPCRecovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"golang.org/x/net/context"
	"github.com/gorilla/handlers"
	"google.golang.org/grpc"

	authGW "Jarvis/api/auth"
	usersGW "Jarvis/api/users"
	"Jarvis/controllers/auth"
	"Jarvis/controllers/users"
)

// StartGRPCServer starts gRPC server for REST wrapper.
func StartGRPCServer(gRPCPort uint16) (err error) {
	s := grpc.NewServer(
		grpc.StreamInterceptor(gRPCMiddleware.ChainStreamServer(
			gRPCRecovery.StreamServerInterceptor(),
		)),
		grpc.UnaryInterceptor(gRPCMiddleware.ChainUnaryServer(
			gRPCRecovery.UnaryServerInterceptor(),
		)),
	)

	authGW.RegisterAuthServer(s, &auth.RPC{})
	usersGW.RegisterUsersServer(s, &users.RPC{})

	lis, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", gRPCPort))
	if err != nil {
		return
	}

	// Start listening.
	err = s.Serve(lis)
	return
}

// StartREST starts REST wrapper for gRPC.
func StartREST(RESTPort, gRPCPort uint16, useLogger bool) (err error) {
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux()
	opts := []grpc.DialOption{grpc.WithInsecure()}

	gRPCPortStr := fmt.Sprintf(":%d", gRPCPort)
	err = authGW.RegisterAuthHandlerFromEndpoint(ctx, mux, gRPCPortStr, opts)
	if err != nil {
		return
	}
	err = usersGW.RegisterUsersHandlerFromEndpoint(ctx, mux, gRPCPortStr, opts)
	if err != nil {
		return
	}

	methods := handlers.AllowedMethods([]string{
		"GET",
		"POST",
		"PUT",
		"PATCH",
		"DELETE",
	})
	hCORS := handlers.CORS(methods)(mux)
	handler := hCORS
	if useLogger {
		handler = handlers.LoggingHandler(os.Stdout, hCORS)
	}

	// Start listening.
	err = http.ListenAndServe(fmt.Sprintf(":%d", RESTPort), handler)
	return
}
