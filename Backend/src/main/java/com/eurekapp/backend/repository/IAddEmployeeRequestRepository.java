package com.eurekapp.backend.repository;

import com.eurekapp.backend.model.AddEmployeeRequest;
import com.eurekapp.backend.model.AddEmployeeRequestStatus;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.UserEurekapp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface IAddEmployeeRequestRepository extends JpaRepository<AddEmployeeRequest, Long> {
    @Query(value = "SELECT req.id FROM add_employee_request req", nativeQuery = true)
    List<Long> findAllId();
    List<AddEmployeeRequest> findByUserAndOrganizationAndStatus(UserEurekapp user,
                                                                Organization organization,
                                                                AddEmployeeRequestStatus status);
    List<AddEmployeeRequest> findByUserAndStatus(UserEurekapp user,
                                                 AddEmployeeRequestStatus status);
}